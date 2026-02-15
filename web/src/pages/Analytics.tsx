/**
 * ミクロ計量分析ダッシュボード
 *
 * 顧客データに対してOLS回帰を実行し、統計的推測の結果を表示する。
 * - モデル1: 予測LTV = β₀ + β₁·来店頻度 + β₂·平均単価 + β₃·最終来店日数 + β₄·P(Active) + e
 * - モデル2: 平均単価 = β₀ + β₁·来店回数 + β₂·平均人数 + β₃·来店期間 + e
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

const MODEL_DEFS: Record<ModelKey, { label: string; depLabel: string; indepLabels: string[] }> = {
  ltv: {
    label: "モデル1: 予測LTV回帰",
    depLabel: "予測LTV (12ヶ月, 万円)",
    indepLabels: ["来店頻度 (回)", "平均単価 (万円)", "最終来店日数", "P(Active)"],
  },
  spend: {
    label: "モデル2: 平均単価回帰",
    depLabel: "平均単価 (万円)",
    indepLabels: ["累計来店回数", "平均パーティサイズ", "来店期間 (日)"],
  },
};

export function Analytics() {
  const [activeModel, setActiveModel] = useState<ModelKey>("ltv");
  const [useRobust, setUseRobust] = useState(true);

  const { data: customersResp, isLoading } = useQuery({
    queryKey: ["customers-detail-all"],
    queryFn: fetchAllCustomersDetail,
  });

  // Run LTV analysis for each customer
  const analyses = useMemo(() => {
    if (!customersResp?.data) return [];
    return customersResp.data.map((c) => ({
      customer: c,
      ltv: analyzeLtv(c.reservations || [], c.ltvScore ?? null),
    }));
  }, [customersResp]);

  // Run OLS regressions
  const results = useMemo(() => {
    if (analyses.length < 10) return null;

    // Filter customers with at least 1 visit
    const valid = analyses.filter((a) => a.ltv.frequency > 0);
    if (valid.length < 10) return null;

    // Model 1: 予測LTV(12m) = β₀ + β₁·frequency + β₂·avgSpend + β₃·recencyDays + β₄·pAlive + e
    const Y_ltv = valid.map((a) => a.ltv.predictedLtv12m / 10000);
    const X_ltv = valid.map((a) => [
      a.ltv.frequency,
      a.ltv.avgSpendPerVisit / 10000,
      a.ltv.recencyDays,
      a.ltv.isAlive,
    ]);
    const model_ltv = ols(Y_ltv, X_ltv, MODEL_DEFS.ltv.indepLabels, MODEL_DEFS.ltv.depLabel);

    // Model 2: 平均単価 = β₀ + β₁·frequency + β₂·avgPartySize + β₃·visitSpan + e
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

  if (isLoading || !results) {
    return <div className="loading">データ読み込み中...</div>;
  }

  const model = results[activeModel];

  return (
    <div>
      {/* Header */}
      <div className="card" style={{ textAlign: "center", padding: "16px 14px 12px" }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: "#7c3aed", letterSpacing: 1, marginBottom: 2 }}>
          MICRO-ECONOMETRICS
        </div>
        <div style={{ fontSize: 16, fontWeight: 700 }}>ミクロ計量分析</div>
        <div style={{ fontSize: 11, color: "var(--color-text-muted)" }}>
          n = {results.n} | OLS推定 | White (1980) ロバスト標準誤差
        </div>
      </div>

      {/* Model selector */}
      <div style={{ display: "flex", gap: 6, margin: "10px 0" }}>
        {(Object.keys(MODEL_DEFS) as ModelKey[]).map((key) => (
          <button
            key={key}
            className={`btn btn-sm ${activeModel === key ? "btn-primary" : "btn-outline"}`}
            style={{ flex: 1 }}
            onClick={() => setActiveModel(key)}
          >
            {key === "ltv" ? "LTV回帰" : "単価回帰"}
          </button>
        ))}
      </div>

      {/* Model equation */}
      <div className="card">
        <div className="section-title">{MODEL_DEFS[activeModel].label}</div>
        <div style={{ padding: "2px 14px 10px", fontSize: 12, color: "var(--color-text-muted)" }}>
          Y<sub>i</sub> = X<sub>i</sub>&prime;&beta; + e<sub>i</sub>,&nbsp;
          E[e<sub>i</sub>|X<sub>i</sub>] = 0
        </div>
      </div>

      {/* SE toggle */}
      <div className="card" style={{ marginTop: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px" }}>
          <span style={{ fontSize: 12, fontWeight: 600 }}>標準誤差:</span>
          <button
            className={`btn btn-sm ${!useRobust ? "btn-primary" : "btn-outline"}`}
            onClick={() => setUseRobust(false)}
            style={{ padding: "4px 10px", fontSize: 11 }}
          >
            均一分散 se₀
          </button>
          <button
            className={`btn btn-sm ${useRobust ? "btn-primary" : "btn-outline"}`}
            onClick={() => setUseRobust(true)}
            style={{ padding: "4px 10px", fontSize: 11 }}
          >
            White HC0
          </button>
        </div>
      </div>

      {/* Coefficient table */}
      <RegressionTable model={model} useRobust={useRobust} />

      {/* Model fit */}
      <div className="card" style={{ marginTop: 8 }}>
        <div className="section-title">モデル適合度</div>
        <div className="info-row"><span className="info-label">R²</span>{model.r2.toFixed(4)}</div>
        <div className="info-row"><span className="info-label">Adj. R²</span>{model.adjR2.toFixed(4)}</div>
        <div className="info-row"><span className="info-label">σ̂²</span>{model.sigmaHat2.toFixed(2)}</div>
        <div className="info-row"><span className="info-label">n</span>{model.n}</div>
        <div className="info-row"><span className="info-label">k</span>{model.k}</div>
        <div className="info-row"><span className="info-label">d.f.</span>{model.n - model.k}</div>
      </div>

      {/* Residual distribution */}
      <ResidualChart model={model} />

      {/* Fitted vs Actual */}
      <FittedChart model={model} />

      {/* Segment distribution from LTV analysis */}
      <SegmentDistribution analyses={analyses} />

      {/* Methodology */}
      <div className="card" style={{ marginTop: 8 }}>
        <div className="section-title">推定方法</div>
        <div style={{ padding: "4px 14px 14px", fontSize: 11, color: "var(--color-text-muted)", lineHeight: 1.8 }}>
          <strong>OLS推定量:</strong> &beta;&#770; = (X&prime;X)<sup>-1</sup>X&prime;Y<br />
          <strong>均一分散 SE:</strong> se₀(&beta;&#770;<sub>j</sub>) = &radic;(s&sup2;[(X&prime;X)<sup>-1</sup>]<sub>jj</sub>)<br />
          <strong>White SE (HC0):</strong> V&#770; = (X&prime;X)<sup>-1</sup>(&Sigma;e&#770;&sup2;<sub>i</sub>X<sub>i</sub>X<sub>i</sub>&prime;)(X&prime;X)<sup>-1</sup><br />
          <strong>t検定:</strong> T<sub>j</sub> = &beta;&#770;<sub>j</sub> / se(&beta;&#770;<sub>j</sub>) &rarr; N(0,1) (n&rarr;&infin;)<br />
          <strong>95%信頼区間:</strong> [&beta;&#770;<sub>j</sub> &plusmn; t<sub>n-k,0.975</sub> &middot; se(&beta;&#770;<sub>j</sub>)]
        </div>
        <div style={{ padding: "0 14px 12px", fontSize: 10, color: "#7c3aed" }}>
          Ref: White (1980) Econometrica; Hansen (2022) Econometrics; 末石 (2025) ミクロ計量分析
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Sub-components
// ============================================================

function RegressionTable({ model, useRobust }: { model: OLSResult; useRobust: boolean }) {
  const se = useRobust ? model.seRobust : model.se;
  const tStat = useRobust ? model.tStatRobust : model.tStat;
  const pVal = useRobust ? model.pValueRobust : model.pValue;
  const ci = useRobust ? model.ci95Robust : model.ci95;

  return (
    <div className="card" style={{ marginTop: 8, overflowX: "auto" }}>
      <div className="section-title">
        回帰係数 ({useRobust ? "White HC0" : "均一分散"})
      </div>
      <table className="data-table" style={{ minWidth: 480 }}>
        <thead>
          <tr>
            <th>変数</th>
            <th style={{ textAlign: "right" }}>&beta;&#770;</th>
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
              <tr key={name}>
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
        *** p&lt;0.01, ** p&lt;0.05, * p&lt;0.1
      </div>
    </div>
  );
}

function ResidualChart({ model }: { model: OLSResult }) {
  return (
    <div className="card" style={{ marginTop: 8 }}>
      <div className="section-title">残差分布 ê = Y - Xβ̂</div>
      <div style={{ padding: "4px 14px 12px" }}>
        <ResidualHistogram residuals={model.residuals} />
        <div style={{ display: "flex", gap: 12, justifyContent: "center", marginTop: 8 }}>
          <MiniStat label="平均" value={mean(model.residuals).toFixed(4)} />
          <MiniStat label="σ̂" value={Math.sqrt(model.sigmaHat2).toFixed(3)} />
          <MiniStat label="min" value={Math.min(...model.residuals).toFixed(2)} />
          <MiniStat label="max" value={Math.max(...model.residuals).toFixed(2)} />
        </div>
      </div>
    </div>
  );
}

function ResidualHistogram({ residuals }: { residuals: number[] }) {
  const bins = 15;
  const min = Math.min(...residuals);
  const max = Math.max(...residuals);
  const range = max - min || 1;
  const binWidth = range / bins;

  const counts = new Array(bins).fill(0);
  for (const r of residuals) {
    const idx = Math.min(bins - 1, Math.floor((r - min) / binWidth));
    counts[idx]++;
  }
  const maxCount = Math.max(...counts, 1);

  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 1, height: 50 }}>
      {counts.map((c, i) => (
        <div
          key={i}
          style={{
            flex: 1,
            height: `${(c / maxCount) * 100}%`,
            background: "#7c3aed",
            opacity: 0.55,
            borderRadius: "2px 2px 0 0",
            minHeight: c > 0 ? 3 : 0,
          }}
        />
      ))}
    </div>
  );
}

function FittedChart({ model }: { model: OLSResult }) {
  const pairs = model.fitted.map((f, i) => ({
    fitted: f,
    actual: f + model.residuals[i],
  })).sort((a, b) => a.actual - b.actual);
  const maxVal = Math.max(...pairs.map(d => Math.max(d.fitted, d.actual)), 0.1);

  return (
    <div className="card" style={{ marginTop: 8 }}>
      <div className="section-title">Ŷ vs Y (予測 vs 実測)</div>
      <div style={{ padding: "4px 14px 12px" }}>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 1, height: 60 }}>
          {pairs.map((d, i) => {
            const hActual = Math.max(2, (d.actual / maxVal) * 56);
            const hFitted = Math.max(2, (d.fitted / maxVal) * 56);
            return (
              <div key={i} style={{ flex: 1, position: "relative", height: 56 }}>
                <div style={{
                  position: "absolute", bottom: 0, left: 0, right: 0,
                  height: hActual, background: "var(--color-primary)", opacity: 0.25, borderRadius: "2px 2px 0 0",
                }} />
                <div style={{
                  position: "absolute", bottom: 0, left: "15%", right: "15%",
                  height: hFitted, background: "#7c3aed", opacity: 0.7, borderRadius: "2px 2px 0 0",
                }} />
              </div>
            );
          })}
        </div>
        <div style={{ display: "flex", justifyContent: "center", gap: 16, marginTop: 6 }}>
          <Legend color="var(--color-primary)" opacity={0.25} label="実測 Y" />
          <Legend color="#7c3aed" opacity={0.7} label="予測 Ŷ" />
        </div>
      </div>
    </div>
  );
}

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
      <div className="section-title">顧客セグメント分布 (RFM)</div>
      <div style={{ padding: "4px 14px 12px" }}>
        {sorted.map((s) => (
          <div key={s.label} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
            <span style={{
              display: "inline-block", padding: "1px 8px", borderRadius: 8,
              fontSize: 10, fontWeight: 700, background: s.color + "18", color: s.color, minWidth: 70, textAlign: "center",
            }}>{s.label}</span>
            <div style={{ flex: 1, height: 6, background: "#e5e5e5", borderRadius: 3, overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${(s.count / total) * 100}%`, background: s.color, borderRadius: 3, opacity: 0.7 }} />
            </div>
            <span style={{ fontSize: 11, fontWeight: 600, minWidth: 24, textAlign: "right" }}>{s.count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Legend({ color, opacity, label }: { color: string; opacity: number; label: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 10, color: "var(--color-text-muted)" }}>
      <span style={{ width: 10, height: 10, background: color, opacity, borderRadius: 2, display: "inline-block" }} />
      {label}
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ textAlign: "center" }}>
      <div style={{ fontSize: 13, fontWeight: 700 }}>{value}</div>
      <div style={{ fontSize: 9, color: "var(--color-text-muted)" }}>{label}</div>
    </div>
  );
}

function mean(arr: number[]): number {
  return arr.reduce((s, x) => s + x, 0) / arr.length;
}
