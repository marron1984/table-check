/**
 * ミクロ計量分析ダッシュボード
 *
 * 「インサイト・ファースト」設計:
 * 1. まずビジネスインサイト（何が効くのか）を大きく見せる
 * 2. 次にビジュアルで直感的に理解させる
 * 3. テクニカル詳細はアコーディオンで折りたたむ
 *
 * White (1980) のロバスト標準誤差を用いた不均一分散に頑健な推測。
 */
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchAllCustomersDetail } from "../api";
import { analyzeLtv } from "../components/LtvAnalysis";
import { ols } from "../components/Econometrics";
import type { OLSResult } from "../components/Econometrics";

type ModelKey = "ltv" | "spend";

const MODEL_DEFS: Record<ModelKey, {
  label: string; question: string; depLabel: string; indepLabels: string[];
  varDescriptions: Record<string, string>;
}> = {
  ltv: {
    label: "LTVモデル",
    question: "何がLTVを高めるのか？",
    depLabel: "予測LTV (12ヶ月, 万円)",
    indepLabels: ["来店頻度 (回)", "平均単価 (万円)", "最終来店日数", "P(Active)"],
    varDescriptions: {
      "来店頻度 (回)": "来店1回増加あたりのLTV変化",
      "平均単価 (万円)": "平均単価1万円上昇あたりのLTV変化",
      "最終来店日数": "最終来店から1日経過ごとのLTV変化",
      "P(Active)": "アクティブ確率1ポイント上昇あたりのLTV変化",
    },
  },
  spend: {
    label: "単価モデル",
    question: "何が客単価を左右するのか？",
    depLabel: "平均単価 (万円)",
    indepLabels: ["累計来店回数", "平均パーティサイズ", "来店期間 (日)"],
    varDescriptions: {
      "累計来店回数": "来店1回増加ごとの単価変化",
      "平均パーティサイズ": "人数1名増加ごとの単価変化",
      "来店期間 (日)": "顧客期間1日延長ごとの単価変化",
    },
  },
};

export function Analytics() {
  const [activeModel, setActiveModel] = useState<ModelKey>("ltv");
  const [showTechnical, setShowTechnical] = useState(false);
  const [useRobust, setUseRobust] = useState(true);

  const { data: customersResp, isLoading } = useQuery({
    queryKey: ["customers-detail-all"],
    queryFn: fetchAllCustomersDetail,
  });

  const analyses = useMemo(() => {
    if (!customersResp?.data) return [];
    return customersResp.data.map((c) => ({
      customer: c,
      ltv: analyzeLtv(c.reservations || [], c.ltvScore ?? null),
    }));
  }, [customersResp]);

  const results = useMemo(() => {
    if (analyses.length < 10) return null;
    const valid = analyses.filter((a) => a.ltv.frequency > 0);
    if (valid.length < 10) return null;

    const Y_ltv = valid.map((a) => a.ltv.predictedLtv12m / 10000);
    const X_ltv = valid.map((a) => [
      a.ltv.frequency,
      a.ltv.avgSpendPerVisit / 10000,
      a.ltv.recencyDays,
      a.ltv.isAlive,
    ]);
    const model_ltv = ols(Y_ltv, X_ltv, MODEL_DEFS.ltv.indepLabels, MODEL_DEFS.ltv.depLabel);

    const Y_spend = valid.map((a) => a.ltv.avgSpendPerVisit / 10000);
    const X_spend = valid.map((a) => {
      const rsvs = a.customer.reservations || [];
      const avgParty = rsvs.length > 0
        ? rsvs.reduce((s, r) => s + r.partySize, 0) / rsvs.length
        : 2;
      return [a.ltv.frequency, avgParty, a.ltv.visitSpan];
    });
    const model_spend = ols(Y_spend, X_spend, MODEL_DEFS.spend.indepLabels, MODEL_DEFS.spend.depLabel);

    return { ltv: model_ltv, spend: model_spend, n: valid.length };
  }, [analyses]);

  if (isLoading) {
    return (
      <div style={{ textAlign: "center", padding: "60px 16px" }}>
        <div style={{ fontSize: 24, marginBottom: 8 }}>...</div>
        <div style={{ fontSize: 13, color: "var(--color-text-muted)" }}>
          顧客データを分析中
        </div>
      </div>
    );
  }

  if (!results) {
    return (
      <div style={{ textAlign: "center", padding: "60px 16px" }}>
        <div style={{ fontSize: 13, color: "var(--color-text-muted)" }}>
          分析に必要なデータが不足しています
        </div>
      </div>
    );
  }

  const model = results[activeModel];
  const def = MODEL_DEFS[activeModel];

  return (
    <div>
      {/* ===== Hero: Core Question ===== */}
      <div className="card" style={{ padding: "20px 16px 16px", textAlign: "center" }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: "#7c3aed", letterSpacing: 1.5, marginBottom: 6 }}>
          MICRO-ECONOMETRICS
        </div>
        <div style={{ fontSize: 18, fontWeight: 700, lineHeight: 1.4 }}>
          {def.question}
        </div>
        <div style={{ fontSize: 11, color: "var(--color-text-muted)", marginTop: 6 }}>
          {results.n}名の顧客データを統計的に分析
        </div>
      </div>

      {/* Model selector tabs */}
      <div style={{ display: "flex", gap: 6, margin: "10px 0" }}>
        {(Object.keys(MODEL_DEFS) as ModelKey[]).map((key) => (
          <button
            key={key}
            className={`btn btn-sm ${activeModel === key ? "btn-primary" : "btn-outline"}`}
            style={{ flex: 1 }}
            onClick={() => setActiveModel(key)}
          >
            {MODEL_DEFS[key].label}
          </button>
        ))}
      </div>

      {/* ===== 1. Key Insight Cards ===== */}
      <InsightCards model={model} def={def} useRobust={useRobust} />

      {/* ===== 2. Impact Ranking ===== */}
      <ImpactRanking model={model} def={def} useRobust={useRobust} />

      {/* ===== 3. Model Accuracy Gauge ===== */}
      <ModelAccuracy model={model} />

      {/* ===== 4. Scatter: Predicted vs Actual ===== */}
      <ScatterChart model={model} />

      {/* ===== 5. Segment Distribution ===== */}
      <SegmentDistribution analyses={analyses} />

      {/* ===== 6. Technical Details (collapsible) ===== */}
      <div className="card" style={{ marginTop: 8 }}>
        <button
          onClick={() => setShowTechnical(!showTechnical)}
          style={{
            width: "100%", padding: "12px 14px", background: "none", border: "none",
            display: "flex", justifyContent: "space-between", alignItems: "center",
          }}
        >
          <span style={{ fontSize: 11, fontWeight: 700, color: "var(--color-text-muted)", letterSpacing: 0.5, textTransform: "uppercase" as const }}>
            統計テクニカル詳細
          </span>
          <span style={{ fontSize: 14, color: "var(--color-text-muted)", transform: showTechnical ? "rotate(180deg)" : "none", transition: "transform 0.2s" }}>
            ▼
          </span>
        </button>

        {showTechnical && (
          <div>
            {/* SE toggle */}
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 14px 10px" }}>
              <span style={{ fontSize: 11, fontWeight: 600 }}>標準誤差:</span>
              <button
                className={`btn btn-sm ${!useRobust ? "btn-primary" : "btn-outline"}`}
                onClick={() => setUseRobust(false)}
                style={{ padding: "3px 8px", fontSize: 10 }}
              >
                均一分散
              </button>
              <button
                className={`btn btn-sm ${useRobust ? "btn-primary" : "btn-outline"}`}
                onClick={() => setUseRobust(true)}
                style={{ padding: "3px 8px", fontSize: 10 }}
              >
                White HC0
              </button>
            </div>

            {/* Full coefficient table */}
            <RegressionTable model={model} useRobust={useRobust} />

            {/* Model fit stats */}
            <div style={{ borderTop: "1px solid var(--color-border)" }}>
              <div style={{ padding: "10px 14px 4px", fontSize: 11, fontWeight: 700, color: "var(--color-text-muted)" }}>
                適合度指標
              </div>
              <div className="info-row"><span className="info-label">R²</span>{model.r2.toFixed(4)}</div>
              <div className="info-row"><span className="info-label">Adj. R²</span>{model.adjR2.toFixed(4)}</div>
              <div className="info-row"><span className="info-label">σ̂²</span>{model.sigmaHat2.toFixed(2)}</div>
              <div className="info-row"><span className="info-label">n</span>{model.n}</div>
              <div className="info-row"><span className="info-label">k</span>{model.k}</div>
              <div className="info-row"><span className="info-label">d.f.</span>{model.n - model.k}</div>
            </div>

            {/* Residual histogram */}
            <ResidualChart model={model} />

            {/* Methodology */}
            <div style={{ borderTop: "1px solid var(--color-border)", padding: "10px 14px 12px" }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "var(--color-text-muted)", marginBottom: 6 }}>
                推定方法
              </div>
              <div style={{ fontSize: 10, color: "var(--color-text-muted)", lineHeight: 1.8 }}>
                <strong>OLS推定量:</strong> β̂ = (X′X)⁻¹X′Y<br />
                <strong>White SE (HC0):</strong> V̂ = (X′X)⁻¹(Σê²ᵢXᵢXᵢ′)(X′X)⁻¹<br />
                <strong>t検定:</strong> Tⱼ = β̂ⱼ / se(β̂ⱼ) → N(0,1) as n→∞
              </div>
              <div style={{ fontSize: 9, color: "#7c3aed", marginTop: 6 }}>
                White (1980) Econometrica; Hansen (2022) Econometrics
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================
// 1. Insight Cards — 最も重要な発見を大きく表示
// ============================================================

function InsightCards({ model, def, useRobust }: {
  model: OLSResult; def: typeof MODEL_DEFS[ModelKey]; useRobust: boolean;
}) {
  const pVal = useRobust ? model.pValueRobust : model.pValue;

  // Find top significant positive and negative effects (skip intercept at idx 0)
  const effects = model.varNames.slice(1).map((name, i) => ({
    name,
    beta: model.beta[i + 1],
    pValue: pVal[i + 1],
    significant: pVal[i + 1] < 0.05,
    description: def.varDescriptions[name] || name,
  })).sort((a, b) => Math.abs(b.beta) - Math.abs(a.beta));

  const topPositive = effects.find((e) => e.beta > 0 && e.significant);
  const topNegative = effects.find((e) => e.beta < 0 && e.significant);

  return (
    <div style={{ display: "flex", gap: 6, marginBottom: 2 }}>
      {/* Biggest positive driver */}
      <div className="card" style={{ flex: 1, padding: "14px 12px", borderLeft: "3px solid var(--color-success)" }}>
        <div style={{ fontSize: 9, fontWeight: 700, color: "var(--color-success)", letterSpacing: 0.5, marginBottom: 4 }}>
          最大プラス要因
        </div>
        {topPositive ? (
          <>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 2 }}>
              {topPositive.name.replace(/ \(.+\)/, "")}
            </div>
            <div style={{ fontSize: 20, fontWeight: 700, color: "var(--color-success)" }}>
              +{topPositive.beta.toFixed(2)}
              <span style={{ fontSize: 11, fontWeight: 400, color: "var(--color-text-muted)", marginLeft: 2 }}>万円</span>
            </div>
            <div style={{ fontSize: 10, color: "var(--color-text-muted)", marginTop: 4, lineHeight: 1.4 }}>
              {topPositive.description}
            </div>
          </>
        ) : (
          <div style={{ fontSize: 11, color: "var(--color-text-muted)" }}>
            有意なプラス要因なし
          </div>
        )}
      </div>

      {/* Biggest negative driver */}
      <div className="card" style={{ flex: 1, padding: "14px 12px", borderLeft: "3px solid var(--color-danger)" }}>
        <div style={{ fontSize: 9, fontWeight: 700, color: "var(--color-danger)", letterSpacing: 0.5, marginBottom: 4 }}>
          最大マイナス要因
        </div>
        {topNegative ? (
          <>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 2 }}>
              {topNegative.name.replace(/ \(.+\)/, "")}
            </div>
            <div style={{ fontSize: 20, fontWeight: 700, color: "var(--color-danger)" }}>
              {topNegative.beta.toFixed(2)}
              <span style={{ fontSize: 11, fontWeight: 400, color: "var(--color-text-muted)", marginLeft: 2 }}>万円</span>
            </div>
            <div style={{ fontSize: 10, color: "var(--color-text-muted)", marginTop: 4, lineHeight: 1.4 }}>
              {topNegative.description}
            </div>
          </>
        ) : (
          <div style={{ fontSize: 11, color: "var(--color-text-muted)" }}>
            有意なマイナス要因なし
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================
// 2. Impact Ranking — 各変数の影響を視覚的にランキング
// ============================================================

function ImpactRanking({ model, def, useRobust }: {
  model: OLSResult; def: typeof MODEL_DEFS[ModelKey]; useRobust: boolean;
}) {
  const pVal = useRobust ? model.pValueRobust : model.pValue;
  const se = useRobust ? model.seRobust : model.se;

  // Skip intercept (index 0)
  const vars = model.varNames.slice(1).map((name, i) => ({
    name,
    beta: model.beta[i + 1],
    se: se[i + 1],
    pValue: pVal[i + 1],
    significant: pVal[i + 1] < 0.05,
  })).sort((a, b) => Math.abs(b.beta) - Math.abs(a.beta));

  const maxAbsBeta = Math.max(...vars.map((v) => Math.abs(v.beta)), 0.01);

  return (
    <div className="card" style={{ marginTop: 8 }}>
      <div className="section-title">変数の影響度ランキング</div>
      <div style={{ padding: "4px 14px 14px" }}>
        {vars.map((v, i) => {
          const pct = (v.beta / maxAbsBeta) * 100;
          const isPositive = v.beta > 0;
          const barColor = v.significant
            ? (isPositive ? "var(--color-success)" : "var(--color-danger)")
            : "#ccc";
          const sigLabel = v.pValue < 0.01 ? "***" : v.pValue < 0.05 ? "**" : v.pValue < 0.1 ? "*" : "";

          return (
            <div key={v.name} style={{ marginBottom: i < vars.length - 1 ? 12 : 0 }}>
              {/* Variable label row */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 3 }}>
                <span style={{ fontSize: 12, fontWeight: 600 }}>
                  {v.name}
                </span>
                <span style={{
                  fontSize: 13, fontWeight: 700, fontVariantNumeric: "tabular-nums",
                  color: v.significant ? (isPositive ? "var(--color-success)" : "var(--color-danger)") : "var(--color-text-muted)",
                }}>
                  {isPositive ? "+" : ""}{v.beta.toFixed(3)}
                  {sigLabel && <span style={{ fontSize: 9, color: "#e53935", marginLeft: 1 }}>{sigLabel}</span>}
                </span>
              </div>

              {/* Bidirectional bar chart (center = 0) */}
              <div style={{ position: "relative", height: 14, background: "#f0f0f0", borderRadius: 7, overflow: "hidden" }}>
                {/* Center line */}
                <div style={{
                  position: "absolute", left: "50%", top: 0, bottom: 0,
                  width: 1, background: "#ccc", zIndex: 1,
                }} />
                {/* Bar */}
                <div style={{
                  position: "absolute",
                  top: 2, bottom: 2,
                  ...(isPositive
                    ? { left: "50%", width: `${Math.abs(pct) / 2}%` }
                    : { right: "50%", width: `${Math.abs(pct) / 2}%` }),
                  background: barColor,
                  borderRadius: 5,
                  opacity: v.significant ? 0.8 : 0.35,
                  transition: "width 0.3s ease",
                }} />
              </div>

              {/* Description */}
              <div style={{ fontSize: 10, color: "var(--color-text-muted)", marginTop: 2 }}>
                {def.varDescriptions[v.name] || ""}
                {!v.significant && (
                  <span style={{ marginLeft: 4, color: "#aaa" }}>(統計的に有意でない)</span>
                )}
              </div>
            </div>
          );
        })}

        <div style={{ fontSize: 9, color: "var(--color-text-muted)", marginTop: 8, textAlign: "right" }}>
          *** p&lt;0.01 &nbsp; ** p&lt;0.05 &nbsp; * p&lt;0.1
          &nbsp; | {useRobust ? "White HC0" : "均一分散"} SE
        </div>
      </div>
    </div>
  );
}

// ============================================================
// 3. Model Accuracy — R²をゲージで直感的に表示
// ============================================================

function ModelAccuracy({ model }: { model: OLSResult }) {
  const r2Pct = Math.round(model.r2 * 100);
  const quality = r2Pct >= 70 ? "高い" : r2Pct >= 40 ? "中程度" : "低い";
  const qualityColor = r2Pct >= 70 ? "var(--color-success)" : r2Pct >= 40 ? "var(--color-warning)" : "var(--color-danger)";

  return (
    <div className="card" style={{ marginTop: 8 }}>
      <div className="section-title">モデルの説明力</div>
      <div style={{ padding: "8px 14px 14px" }}>
        {/* Gauge arc */}
        <div style={{ textAlign: "center", marginBottom: 8 }}>
          <div style={{ position: "relative", display: "inline-block", width: 120, height: 66 }}>
            <svg viewBox="0 0 120 66" style={{ width: 120, height: 66 }}>
              {/* Background arc */}
              <path
                d={describeArc(60, 60, 50, 180, 360)}
                fill="none" stroke="#e8e8e8" strokeWidth="10" strokeLinecap="round"
              />
              {/* Filled arc */}
              <path
                d={describeArc(60, 60, 50, 180, 180 + (r2Pct / 100) * 180)}
                fill="none" stroke={qualityColor} strokeWidth="10" strokeLinecap="round"
              />
            </svg>
            <div style={{
              position: "absolute", bottom: 0, left: "50%", transform: "translateX(-50%)",
              fontSize: 22, fontWeight: 700, lineHeight: 1,
            }}>
              {r2Pct}%
            </div>
          </div>
        </div>

        <div style={{ textAlign: "center" }}>
          <span style={{
            display: "inline-block", padding: "2px 10px", borderRadius: 8,
            fontSize: 11, fontWeight: 700, background: qualityColor + "15", color: qualityColor,
          }}>
            説明力: {quality}
          </span>
        </div>
        <div style={{ textAlign: "center", fontSize: 11, color: "var(--color-text-muted)", marginTop: 6 }}>
          このモデルは{MODEL_DEFS[model.depVar === "予測LTV (12ヶ月, 万円)" ? "ltv" : "spend"].depLabel}の
          変動の<strong style={{ color: "var(--color-text)" }}>{r2Pct}%</strong>を説明しています
        </div>
      </div>
    </div>
  );
}

/** SVG arc path helper */
function describeArc(cx: number, cy: number, r: number, startAngle: number, endAngle: number): string {
  const start = polarToCartesian(cx, cy, r, endAngle);
  const end = polarToCartesian(cx, cy, r, startAngle);
  const largeArcFlag = endAngle - startAngle <= 180 ? "0" : "1";
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArcFlag} 0 ${end.x} ${end.y}`;
}

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

// ============================================================
// 4. Scatter Chart — 予測 vs 実測 の散布図
// ============================================================

function ScatterChart({ model }: { model: OLSResult }) {
  const pairs = model.fitted.map((f, i) => ({
    fitted: f,
    actual: f + model.residuals[i],
  }));

  const allVals = pairs.flatMap((p) => [p.fitted, p.actual]);
  const minVal = Math.min(...allVals);
  const maxVal = Math.max(...allVals);
  const range = maxVal - minVal || 1;

  const W = 260;
  const H = 200;
  const PAD = 28;

  const toX = (v: number) => PAD + ((v - minVal) / range) * (W - PAD * 2);
  const toY = (v: number) => H - PAD - ((v - minVal) / range) * (H - PAD * 2);

  return (
    <div className="card" style={{ marginTop: 8 }}>
      <div className="section-title">予測精度: Ŷ vs 実測Y</div>
      <div style={{ padding: "4px 14px 12px", textAlign: "center" }}>
        <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", maxWidth: W, height: "auto" }}>
          {/* 45-degree line (perfect prediction) */}
          <line
            x1={toX(minVal)} y1={toY(minVal)}
            x2={toX(maxVal)} y2={toY(maxVal)}
            stroke="#ddd" strokeWidth="1.5" strokeDasharray="4,3"
          />
          {/* Axis labels */}
          <text x={W / 2} y={H - 4} textAnchor="middle" fontSize="9" fill="#999">予測値 Ŷ</text>
          <text x={6} y={H / 2} textAnchor="middle" fontSize="9" fill="#999" transform={`rotate(-90, 6, ${H / 2})`}>
            実測値 Y
          </text>
          {/* Data points */}
          {pairs.map((p, i) => (
            <circle
              key={i}
              cx={toX(p.fitted)}
              cy={toY(p.actual)}
              r={3}
              fill="#7c3aed"
              opacity={0.45}
            />
          ))}
        </svg>
        <div style={{ fontSize: 10, color: "var(--color-text-muted)", marginTop: 4 }}>
          点が斜線に近いほど予測精度が高い
        </div>
      </div>
    </div>
  );
}

// ============================================================
// 5. Segment Distribution
// ============================================================

function SegmentDistribution({ analyses }: { analyses: { ltv: { segment: string; segmentLabel: string; segmentColor: string } }[] }) {
  const counts: Record<string, { label: string; color: string; count: number }> = {};
  for (const a of analyses) {
    if (!counts[a.ltv.segment]) {
      counts[a.ltv.segment] = { label: a.ltv.segmentLabel, color: a.ltv.segmentColor, count: 0 };
    }
    counts[a.ltv.segment].count++;
  }
  const sorted = Object.values(counts).sort((a, b) => b.count - a.count);
  const total = analyses.length || 1;

  return (
    <div className="card" style={{ marginTop: 8 }}>
      <div className="section-title">顧客セグメント分布</div>
      <div style={{ padding: "4px 14px 14px" }}>
        {/* Stacked bar */}
        <div style={{ display: "flex", height: 20, borderRadius: 10, overflow: "hidden", marginBottom: 10 }}>
          {sorted.map((s) => (
            <div
              key={s.label}
              style={{
                width: `${(s.count / total) * 100}%`,
                background: s.color,
                opacity: 0.7,
                minWidth: s.count > 0 ? 2 : 0,
              }}
              title={`${s.label}: ${s.count}名`}
            />
          ))}
        </div>
        {/* Legend rows */}
        {sorted.map((s) => (
          <div key={s.label} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
            <span style={{
              width: 10, height: 10, borderRadius: 3,
              background: s.color, opacity: 0.7, flexShrink: 0,
            }} />
            <span style={{ fontSize: 12, flex: 1 }}>{s.label}</span>
            <span style={{ fontSize: 12, fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>
              {s.count}
            </span>
            <span style={{ fontSize: 10, color: "var(--color-text-muted)", width: 36, textAlign: "right" }}>
              {Math.round((s.count / total) * 100)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================
// Technical sub-components (inside accordion)
// ============================================================

function RegressionTable({ model, useRobust }: { model: OLSResult; useRobust: boolean }) {
  const se = useRobust ? model.seRobust : model.se;
  const tStat = useRobust ? model.tStatRobust : model.tStat;
  const pVal = useRobust ? model.pValueRobust : model.pValue;
  const ci = useRobust ? model.ci95Robust : model.ci95;

  return (
    <div style={{ overflowX: "auto", borderTop: "1px solid var(--color-border)" }}>
      <div style={{ padding: "10px 14px 4px", fontSize: 11, fontWeight: 700, color: "var(--color-text-muted)" }}>
        回帰係数テーブル
      </div>
      <table className="data-table" style={{ minWidth: 460 }}>
        <thead>
          <tr>
            <th>変数</th>
            <th style={{ textAlign: "right" }}>β̂</th>
            <th style={{ textAlign: "right" }}>SE</th>
            <th style={{ textAlign: "right" }}>t値</th>
            <th style={{ textAlign: "right" }}>p値</th>
            <th style={{ textAlign: "right" }}>95% CI</th>
          </tr>
        </thead>
        <tbody>
          {model.varNames.map((name, j) => {
            const sig = pVal[j] < 0.01 ? "***" : pVal[j] < 0.05 ? "**" : pVal[j] < 0.1 ? "*" : "";
            return (
              <tr key={name} style={{ background: pVal[j] < 0.05 && j > 0 ? "#f0fdf4" : undefined }}>
                <td style={{ fontWeight: 600, fontSize: 11 }}>{name}</td>
                <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums", fontSize: 12 }}>
                  {model.beta[j].toFixed(4)}
                </td>
                <td style={{ textAlign: "right", fontSize: 11, color: "var(--color-text-muted)" }}>
                  ({se[j].toFixed(4)})
                </td>
                <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums", fontSize: 12 }}>
                  {tStat[j].toFixed(2)}
                  <span style={{ color: "#e53935", fontSize: 10, marginLeft: 1 }}>{sig}</span>
                </td>
                <td style={{ textAlign: "right", fontSize: 11, color: pVal[j] < 0.05 ? "var(--color-primary)" : "var(--color-text-muted)" }}>
                  {pVal[j] < 0.001 ? "<.001" : pVal[j].toFixed(3)}
                </td>
                <td style={{ textAlign: "right", fontSize: 10, color: "var(--color-text-muted)" }}>
                  [{ci[j][0].toFixed(2)}, {ci[j][1].toFixed(2)}]
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div style={{ padding: "6px 14px 10px", fontSize: 10, color: "var(--color-text-muted)" }}>
        *** p&lt;0.01, ** p&lt;0.05, * p&lt;0.1 | 有意な変数は緑背景
      </div>
    </div>
  );
}

function ResidualChart({ model }: { model: OLSResult }) {
  const bins = 15;
  const min = Math.min(...model.residuals);
  const max = Math.max(...model.residuals);
  const range = max - min || 1;
  const binWidth = range / bins;

  const counts = new Array(bins).fill(0);
  for (const r of model.residuals) {
    const idx = Math.min(bins - 1, Math.floor((r - min) / binWidth));
    counts[idx]++;
  }
  const maxCount = Math.max(...counts, 1);

  return (
    <div style={{ borderTop: "1px solid var(--color-border)", padding: "10px 14px 12px" }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: "var(--color-text-muted)", marginBottom: 6 }}>
        残差分布 ê = Y − Ŷ
      </div>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 1, height: 40 }}>
        {counts.map((c, i) => (
          <div
            key={i}
            style={{
              flex: 1,
              height: `${(c / maxCount) * 100}%`,
              background: "#7c3aed",
              opacity: 0.5,
              borderRadius: "2px 2px 0 0",
              minHeight: c > 0 ? 2 : 0,
            }}
          />
        ))}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 9, color: "var(--color-text-muted)", marginTop: 4 }}>
        <span>{min.toFixed(1)}</span>
        <span>0</span>
        <span>{max.toFixed(1)}</span>
      </div>
    </div>
  );
}
