/**
 * LTV分析コンポーネント
 *
 * ミクロ計量経済学的アプローチ:
 * - RFM分析 (Recency, Frequency, Monetary)
 * - BG/NBDモデル風の来店確率予測
 * - Gamma-Gammaモデル風の予測単価
 * - 顧客セグメント分類
 * - CLV (Customer Lifetime Value) 予測
 */
import type { Reservation } from "../api";

// ============================================================
// Types
// ============================================================
export interface LtvAnalysisResult {
  // RFM
  recencyDays: number;
  frequency: number;
  monetaryAvg: number;
  rfmScore: { r: number; f: number; m: number; total: number };

  // Historical
  totalSpend: number;
  avgSpendPerVisit: number;
  visitSpan: number; // days between first and last visit
  avgIntervisitDays: number;

  // Predicted (BG/NBD + Gamma-Gamma inspired)
  expectedVisits90: number;
  expectedVisits180: number;
  expectedVisits365: number;
  predictedSpendPerVisit: number;
  predictedLtv12m: number;
  predictedLtv36m: number;
  churnProbability: number;
  isAlive: number; // P(alive)

  // Segment
  segment: CustomerSegment;
  segmentLabel: string;
  segmentColor: string;

  // Trend
  spendTrend: "up" | "down" | "stable";
  frequencyTrend: "up" | "down" | "stable";

  // Quarterly breakdown (last 4 quarters)
  quarterlyData: { label: string; visits: number; spend: number }[];
}

type CustomerSegment =
  | "champion"
  | "loyal"
  | "potential_loyalist"
  | "new_customer"
  | "promising"
  | "need_attention"
  | "about_to_sleep"
  | "at_risk"
  | "hibernating"
  | "lost";

const SEGMENT_CONFIG: Record<CustomerSegment, { label: string; color: string }> = {
  champion:          { label: "チャンピオン", color: "#1b5e20" },
  loyal:             { label: "ロイヤル", color: "#2e7d32" },
  potential_loyalist:{ label: "ロイヤル候補", color: "#43a047" },
  new_customer:      { label: "新規顧客", color: "#0277bd" },
  promising:         { label: "有望", color: "#0288d1" },
  need_attention:    { label: "要注意", color: "#f9a825" },
  about_to_sleep:    { label: "休眠兆候", color: "#ff8f00" },
  at_risk:           { label: "離反リスク", color: "#e65100" },
  hibernating:       { label: "休眠", color: "#78909c" },
  lost:              { label: "離反", color: "#546e7a" },
};

// ============================================================
// Analysis functions
// ============================================================

/**
 * 予約履歴からLTV分析を実行
 */
export function analyzeLtv(
  reservations: Reservation[],
  existingLtv: number | null,
): LtvAnalysisResult {
  const now = new Date();

  // Filter completed/confirmed reservations (exclude cancelled/no-show)
  const validStatuses = new Set(["COMPLETED", "CONFIRMED", "SEATED"]);
  const valid = reservations
    .filter((r) => validStatuses.has(r.status))
    .sort((a, b) => new Date(a.dateTime).getTime() - new Date(b.dateTime).getTime());

  const n = valid.length;

  if (n === 0) {
    return emptyResult();
  }

  // Dates
  const dates = valid.map((r) => new Date(r.dateTime));
  const firstVisit = dates[0];
  const lastVisit = dates[n - 1];
  const recencyDays = Math.max(0, Math.round((now.getTime() - lastVisit.getTime()) / 86400000));
  const visitSpan = Math.max(1, Math.round((lastVisit.getTime() - firstVisit.getTime()) / 86400000));

  // Monetary: estimate from course name (if no amount field)
  const courseSpendEstimates = valid.map((r) => estimateSpend(r));
  const totalSpend = existingLtv && existingLtv > 0 ? existingLtv : courseSpendEstimates.reduce((a, b) => a + b, 0);
  const avgSpendPerVisit = totalSpend / n;

  // Inter-visit intervals
  const intervals: number[] = [];
  for (let i = 1; i < dates.length; i++) {
    intervals.push((dates[i].getTime() - dates[i - 1].getTime()) / 86400000);
  }
  const avgIntervisitDays = intervals.length > 0
    ? intervals.reduce((a, b) => a + b, 0) / intervals.length
    : 90;

  // ============================================================
  // RFM Scoring (1-5 quintile)
  // ============================================================
  const rScore = recencyDays <= 14 ? 5 : recencyDays <= 30 ? 4 : recencyDays <= 60 ? 3 : recencyDays <= 90 ? 2 : 1;
  const fScore = n >= 15 ? 5 : n >= 10 ? 4 : n >= 6 ? 3 : n >= 3 ? 2 : 1;
  const mScore = avgSpendPerVisit >= 60000 ? 5 : avgSpendPerVisit >= 45000 ? 4 : avgSpendPerVisit >= 35000 ? 3 : avgSpendPerVisit >= 25000 ? 2 : 1;
  const rfmTotal = rScore + fScore + mScore;

  // ============================================================
  // BG/NBD-inspired purchase rate (lambda) and dropout rate (mu)
  // P(alive) = 1 / (1 + mu/lambda * (T - tx))
  // ============================================================
  const T = Math.max(1, (now.getTime() - firstVisit.getTime()) / 86400000); // observation period
  const tx = T - recencyDays; // time of last transaction
  const lambda = n / T; // purchase rate (per day)
  const mu = 1 / (avgIntervisitDays * 3); // dropout rate estimate

  // P(alive) - simplified BG/NBD
  const pAlive = Math.min(0.99, Math.max(0.01, 1 / (1 + (mu / Math.max(lambda, 0.001)) * recencyDays)));

  // Expected visits in future periods
  const expectedVisits = (days: number) => {
    return pAlive * lambda * days;
  };

  const ev90 = Math.round(expectedVisits(90) * 10) / 10;
  const ev180 = Math.round(expectedVisits(180) * 10) / 10;
  const ev365 = Math.round(expectedVisits(365) * 10) / 10;

  // ============================================================
  // Gamma-Gamma-inspired monetary prediction
  // Adjust for spend trend
  // ============================================================
  const recentSpends = courseSpendEstimates.slice(-Math.min(5, n));
  const olderSpends = courseSpendEstimates.slice(0, Math.max(1, n - 5));
  const recentAvg = recentSpends.reduce((a, b) => a + b, 0) / recentSpends.length;
  const olderAvg = olderSpends.reduce((a, b) => a + b, 0) / olderSpends.length;
  const spendGrowth = olderAvg > 0 ? (recentAvg - olderAvg) / olderAvg : 0;

  // Predicted spend: weighted average with trend adjustment
  const predictedSpend = Math.round(avgSpendPerVisit * (1 + spendGrowth * 0.3));

  // Predicted LTV
  const discountRate = 0.10; // 10% annual discount rate
  const monthlyDiscount = Math.pow(1 + discountRate, 1 / 12) - 1;

  const predictedLtv = (months: number) => {
    let ltv = 0;
    for (let m = 1; m <= months; m++) {
      const survivalProb = Math.pow(pAlive, m / 12);
      const monthlyVisits = lambda * 30;
      const discountFactor = 1 / Math.pow(1 + monthlyDiscount, m);
      ltv += survivalProb * monthlyVisits * predictedSpend * discountFactor;
    }
    return Math.round(ltv);
  };

  // Churn probability
  const churnProbability = Math.round((1 - pAlive) * 100) / 100;

  // ============================================================
  // Segment classification
  // ============================================================
  const segment = classifySegment(rScore, fScore, mScore);

  // ============================================================
  // Trends
  // ============================================================
  const spendTrend: "up" | "down" | "stable" = spendGrowth > 0.1 ? "up" : spendGrowth < -0.1 ? "down" : "stable";

  // Frequency trend (compare recent intervals vs older)
  const recentIntervals = intervals.slice(-Math.min(3, intervals.length));
  const olderIntervals = intervals.slice(0, Math.max(1, intervals.length - 3));
  const recentIntAvg = recentIntervals.length > 0 ? recentIntervals.reduce((a, b) => a + b, 0) / recentIntervals.length : avgIntervisitDays;
  const olderIntAvg = olderIntervals.length > 0 ? olderIntervals.reduce((a, b) => a + b, 0) / olderIntervals.length : avgIntervisitDays;
  const frequencyTrend: "up" | "down" | "stable" = recentIntAvg < olderIntAvg * 0.8 ? "up" : recentIntAvg > olderIntAvg * 1.2 ? "down" : "stable";

  // ============================================================
  // Quarterly data (last 4 quarters)
  // ============================================================
  const quarterlyData = computeQuarterlyData(valid, courseSpendEstimates, now);

  return {
    recencyDays,
    frequency: n,
    monetaryAvg: Math.round(avgSpendPerVisit),
    rfmScore: { r: rScore, f: fScore, m: mScore, total: rfmTotal },
    totalSpend: Math.round(totalSpend),
    avgSpendPerVisit: Math.round(avgSpendPerVisit),
    visitSpan,
    avgIntervisitDays: Math.round(avgIntervisitDays),
    expectedVisits90: ev90,
    expectedVisits180: ev180,
    expectedVisits365: ev365,
    predictedSpendPerVisit: predictedSpend,
    predictedLtv12m: predictedLtv(12),
    predictedLtv36m: predictedLtv(36),
    churnProbability,
    isAlive: Math.round(pAlive * 100) / 100,
    segment,
    segmentLabel: SEGMENT_CONFIG[segment].label,
    segmentColor: SEGMENT_CONFIG[segment].color,
    spendTrend,
    frequencyTrend,
    quarterlyData,
  };
}

function estimateSpend(r: Reservation): number {
  // Estimate from course name patterns
  const name = r.courseName || "";
  if (name.includes("スペシャル") || name.includes("ペアリング")) return 75000 * r.partySize;
  if (name.includes("シェフズ")) return 65000 * r.partySize;
  if (name.includes("おまかせ特別")) return 55000 * r.partySize;
  if (name.includes("フレンチ") || name.includes("フルコース")) return 48000 * r.partySize;
  if (name.includes("プレミアム")) return 45000 * r.partySize;
  if (name.includes("和牛")) return 42000 * r.partySize;
  if (name.includes("懐石") || name.includes("雅")) return 38000 * r.partySize;
  if (name.includes("鮨") || name.includes("おまかせ")) return 35000 * r.partySize;
  if (name.includes("天ぷら")) return 30000 * r.partySize;
  if (name.includes("ランチ")) return 18000 * r.partySize;
  return 40000 * r.partySize; // default
}

function classifySegment(r: number, f: number, _m: number): CustomerSegment {
  if (r >= 4 && f >= 4) return "champion";
  if (r >= 3 && f >= 4) return "loyal";
  if (r >= 4 && f >= 2) return "potential_loyalist";
  if (r >= 4 && f === 1) return "new_customer";
  if (r >= 3 && f >= 2) return "promising";
  if (r === 2 && f >= 3) return "need_attention";
  if (r === 2 && f >= 1) return "about_to_sleep";
  if (r === 1 && f >= 3) return "at_risk";
  if (r === 1 && f >= 1) return "hibernating";
  return "lost";
}

function computeQuarterlyData(
  valid: Reservation[],
  spends: number[],
  now: Date,
): { label: string; visits: number; spend: number }[] {
  const quarters: { label: string; visits: number; spend: number }[] = [];
  for (let q = 3; q >= 0; q--) {
    const qEnd = new Date(now);
    qEnd.setMonth(qEnd.getMonth() - q * 3);
    const qStart = new Date(qEnd);
    qStart.setMonth(qStart.getMonth() - 3);

    const qLabel = `${qStart.getFullYear()}Q${Math.floor(qStart.getMonth() / 3) + 1}`;
    let visits = 0;
    let spend = 0;
    for (let i = 0; i < valid.length; i++) {
      const d = new Date(valid[i].dateTime);
      if (d >= qStart && d < qEnd) {
        visits++;
        spend += spends[i];
      }
    }
    quarters.push({ label: qLabel, visits, spend: Math.round(spend) });
  }
  return quarters;
}

function emptyResult(): LtvAnalysisResult {
  return {
    recencyDays: 999,
    frequency: 0,
    monetaryAvg: 0,
    rfmScore: { r: 1, f: 1, m: 1, total: 3 },
    totalSpend: 0,
    avgSpendPerVisit: 0,
    visitSpan: 0,
    avgIntervisitDays: 0,
    expectedVisits90: 0,
    expectedVisits180: 0,
    expectedVisits365: 0,
    predictedSpendPerVisit: 0,
    predictedLtv12m: 0,
    predictedLtv36m: 0,
    churnProbability: 1,
    isAlive: 0,
    segment: "lost",
    segmentLabel: SEGMENT_CONFIG.lost.label,
    segmentColor: SEGMENT_CONFIG.lost.color,
    spendTrend: "stable",
    frequencyTrend: "stable",
    quarterlyData: [],
  };
}

// ============================================================
// UI Component
// ============================================================
interface LtvPanelProps {
  reservations: Reservation[];
  existingLtv: number | null;
}

export function LtvPanel({ reservations, existingLtv }: LtvPanelProps) {
  const a = analyzeLtv(reservations, existingLtv);

  if (a.frequency === 0) {
    return (
      <div className="card">
        <div className="section-title">LTV分析</div>
        <div style={{ padding: "12px", fontSize: 13, color: "var(--color-text-muted)" }}>
          来店履歴がないため分析できません
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Segment & P(Alive) */}
      <div className="card">
        <div className="section-title">顧客セグメント</div>
        <div style={{ padding: "8px 12px", display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{
            display: "inline-block",
            padding: "3px 10px",
            borderRadius: 10,
            fontSize: 12,
            fontWeight: 700,
            background: a.segmentColor + "18",
            color: a.segmentColor,
          }}>
            {a.segmentLabel}
          </span>
          <span style={{ fontSize: 12, color: "var(--color-text-muted)" }}>
            P(Active) = {Math.round(a.isAlive * 100)}%
          </span>
        </div>
      </div>

      {/* Predicted LTV */}
      <div className="card">
        <div className="section-title">予測LTV (Discounted CLV)</div>
        <div style={{ padding: "4px 12px 8px" }}>
          <div style={{ display: "flex", gap: 8, marginBottom: 4 }}>
            <div style={{ flex: 1, background: "#f5f5f5", borderRadius: 8, padding: "8px 10px", textAlign: "center" }}>
              <div style={{ fontSize: 18, fontWeight: 700, color: "var(--color-primary)" }}>
                {formatYen(a.predictedLtv12m)}
              </div>
              <div style={{ fontSize: 10, color: "var(--color-text-muted)" }}>12ヶ月予測</div>
            </div>
            <div style={{ flex: 1, background: "#f5f5f5", borderRadius: 8, padding: "8px 10px", textAlign: "center" }}>
              <div style={{ fontSize: 18, fontWeight: 700, color: "var(--color-text)" }}>
                {formatYen(a.predictedLtv36m)}
              </div>
              <div style={{ fontSize: 10, color: "var(--color-text-muted)" }}>36ヶ月予測</div>
            </div>
          </div>
          <div style={{ fontSize: 10, color: "var(--color-text-muted)", textAlign: "right" }}>
            割引率 10%/年, BG/NBD + Gamma-Gamma
          </div>
        </div>
      </div>

      {/* RFM Score */}
      <div className="card">
        <div className="section-title">RFM分析</div>
        <div style={{ padding: "4px 12px 12px" }}>
          <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
            <RfmBar label="R" sublabel={`${a.recencyDays}日前`} score={a.rfmScore.r} color="#0066ff" />
            <RfmBar label="F" sublabel={`${a.frequency}回`} score={a.rfmScore.f} color="#43a047" />
            <RfmBar label="M" sublabel={formatYen(a.monetaryAvg)} score={a.rfmScore.m} color="#ff8f00" />
          </div>
          <div style={{ textAlign: "center", fontSize: 12, color: "var(--color-text-muted)" }}>
            RFMスコア合計: <strong style={{ color: "var(--color-text)" }}>{a.rfmScore.total}</strong> / 15
          </div>
        </div>
      </div>

      {/* Expected visits */}
      <div className="card">
        <div className="section-title">来店予測 (BG/NBDモデル)</div>
        <div className="info-row">
          <span className="info-label">90日</span>
          <span>{a.expectedVisits90}回</span>
        </div>
        <div className="info-row">
          <span className="info-label">180日</span>
          <span>{a.expectedVisits180}回</span>
        </div>
        <div className="info-row">
          <span className="info-label">365日</span>
          <span>{a.expectedVisits365}回</span>
        </div>
        <div className="info-row">
          <span className="info-label">予測単価</span>
          <span>{formatYen(a.predictedSpendPerVisit)}</span>
          {a.spendTrend !== "stable" && (
            <span style={{ fontSize: 11, color: a.spendTrend === "up" ? "#43a047" : "#e53935", marginLeft: 4 }}>
              {a.spendTrend === "up" ? "↑" : "↓"}
            </span>
          )}
        </div>
        <div className="info-row">
          <span className="info-label">離反確率</span>
          <span style={{ color: a.churnProbability > 0.5 ? "var(--color-danger)" : "inherit" }}>
            {Math.round(a.churnProbability * 100)}%
          </span>
        </div>
      </div>

      {/* Quarterly trend */}
      {a.quarterlyData.length > 0 && (
        <div className="card">
          <div className="section-title">四半期推移</div>
          <div style={{ padding: "4px 12px 12px" }}>
            <div style={{ display: "flex", gap: 4, alignItems: "flex-end", height: 60, marginBottom: 4 }}>
              {a.quarterlyData.map((q) => {
                const maxSpend = Math.max(...a.quarterlyData.map((d) => d.spend), 1);
                const h = Math.max(4, (q.spend / maxSpend) * 56);
                return (
                  <div key={q.label} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center" }}>
                    <div style={{
                      width: "100%",
                      height: h,
                      background: q.spend > 0 ? "var(--color-primary)" : "#e5e5e5",
                      borderRadius: 4,
                      opacity: q.spend > 0 ? 0.7 : 0.3,
                    }} />
                  </div>
                );
              })}
            </div>
            <div style={{ display: "flex", gap: 4 }}>
              {a.quarterlyData.map((q) => (
                <div key={q.label} style={{ flex: 1, textAlign: "center" }}>
                  <div style={{ fontSize: 9, color: "var(--color-text-muted)" }}>{q.label}</div>
                  <div style={{ fontSize: 10, fontWeight: 600 }}>{q.visits}回</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Key metrics */}
      <div className="card">
        <div className="section-title">実績サマリ</div>
        <div className="info-row"><span className="info-label">累計来店</span>{a.frequency}回</div>
        <div className="info-row"><span className="info-label">累計売上</span>{formatYen(a.totalSpend)}</div>
        <div className="info-row"><span className="info-label">平均単価</span>{formatYen(a.avgSpendPerVisit)}</div>
        <div className="info-row"><span className="info-label">平均来店間隔</span>{a.avgIntervisitDays}日</div>
        <div className="info-row">
          <span className="info-label">頻度トレンド</span>
          {a.frequencyTrend === "up" ? "↑ 加速" : a.frequencyTrend === "down" ? "↓ 減速" : "→ 安定"}
        </div>
      </div>
    </>
  );
}

// ============================================================
// Sub-components
// ============================================================
function RfmBar({ label, sublabel, score, color }: { label: string; sublabel: string; score: number; color: string }) {
  return (
    <div style={{ flex: 1, textAlign: "center" }}>
      <div style={{ fontSize: 11, fontWeight: 700, color }}>{label}</div>
      <div style={{
        height: 6,
        background: "#e5e5e5",
        borderRadius: 3,
        overflow: "hidden",
        margin: "4px 0",
      }}>
        <div style={{
          height: "100%",
          width: `${score * 20}%`,
          background: color,
          borderRadius: 3,
        }} />
      </div>
      <div style={{ fontSize: 10, color: "var(--color-text-muted)" }}>{sublabel}</div>
    </div>
  );
}

function formatYen(n: number): string {
  if (n >= 10000) {
    return `${(n / 10000).toFixed(n >= 100000 ? 0 : 1)}万`;
  }
  return `¥${n.toLocaleString()}`;
}
