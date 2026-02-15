/**
 * ミクロ計量分析ダッシュボード
 *
 * 顧客データに対してOLS回帰を実行し、統計的推測の結果を表示する。
 * - モデル1: 予測LTV = β₀ + β₁·来店頻度 + β₂·平均単価 + β₃·最終来店からの日数 + e
 * - モデル2: 平均単価 = β₀ + β₁·来店回数 + β₂·平均人数 + e
 *
 * White (1980) のロバスト標準誤差を用いた不均一分散に頑健な推測。
 */
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { searchCustomers } from "../api";
import type { CustomerDetail } from "../api";
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

  // Fetch all customers (pages 1-5 to get ~100)
  const { data: page1 } = useQuery({ queryKey: ["customers", "", "", 1], queryFn: () => searchCustomers("", undefined, 1) });
  const { data: page2 } = useQuery({ queryKey: ["customers", "", "", 2], queryFn: () => searchCustomers("", undefined, 2) });
  const { data: page3 } = useQuery({ queryKey: ["customers", "", "", 3], queryFn: () => searchCustomers("", undefined, 3) });
  const { data: page4 } = useQuery({ queryKey: ["customers", "", "", 4], queryFn: () => searchCustomers("", undefined, 4) });
  const { data: page5 } = useQuery({ queryKey: ["customers", "", "", 5], queryFn: () => searchCustomers("", undefined, 5) });

  const customers = useMemo(() => {
    const all: CustomerDetail[] = [];
    for (const p of [page1, page2, page3, page4, page5]) {
      if (p?.data) all.push(...(p.data as CustomerDetail[]));
    }
    return all;
  }, [page1, page2, page3, page4, page5]);

  // Run LTV analysis for each customer
  const analyses = useMemo(() => {
    return customers.map((c) => ({
      customer: c,
      ltv: analyzeLtv(c.reservations || [], c.ltvScore ?? null),
    }));
  }, [customers]);

  // Run OLS regressions
  const results = useMemo(() => {
    if (analyses.length < 10) return null;

    // Filter customers with at least 1 visit
    const valid = analyses.filter((a) => a.ltv.frequency > 0);
    if (valid.length < 10) return null;

    // Model 1: 予測LTV(12m) = β₀ + β₁·frequency + β₂·avgSpend + β₃·recencyDays + β₄·pAlive + e
    const Y_ltv = valid.map((a) => a.ltv.predictedLtv12m / 10000); // 万円単位
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
      // Compute avg party size from reservations
      const rsvs = a.customer.reservations || [];
      const avgParty = rsvs.length > 0
        ? rsvs.reduce((s, r) => s + r.partySize, 0) / rsvs.length
        : 2;
      return [a.ltv.frequency, avgParty, a.ltv.visitSpan];
    });
    const model_spend = ols(Y_spend, X_spend, MODEL_DEFS.spend.indepLabels, MODEL_DEFS.spend.depLabel);

    return { ltv: model_ltv, spend: model_spend, n: valid.length };
  }, [analyses]);

  if (!results) {
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

      {/* Model title */}
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
        <div className="info-row"><span className="info-label">σ̂²</span>{model.sigmaHat2.toFixed(4)}</div>
        <div className="info-row"><span className="info-label">n</span>{model.n}</div>
        <div className="info-row"><span className="info-label">k</span>{model.k}</div>
        <div className="info-row"><span className="info-label">d.f.</span>{model.n - model.k}</div>
      </div>

      {/* Residual chart */}
      <ResidualChart model={model} />

      {/* Fitted vs Actual */}
      <FittedChart model={model} />

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
      <table className="data-table" style={{ minWidth: 500 }}>
        <thead>
          <tr>
            <th>変数</th>
            <th style={{ textAlign: "right" }}>&beta;&#770;</th>
            <th style={{ textAlign: "right" }}>SE</th>
            <th style={{ textAlign: "right" }}>t値</th>
            <th style={{ textAlign: "right" }}>p値</th>
            <th style={{ textAlign: "right" }}>95%CI</th>
          </tr>
        </thead>
        <tbody>
          {model.varNames.map((name, j) => {
            const sig = pVal[j] < 0.01 ? "***" : pVal[j] < 0.05 ? "**" : pVal[j] < 0.1 ? "*" : "";
            return (
              <tr key={name}>
                <td style={{ fontWeight: 600, fontSize: 12 }}>{name}</td>
                <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                  {model.beta[j].toFixed(4)}
                </td>
                <td style={{ textAlign: "right", fontSize: 12, color: "var(--color-text-muted)" }}>
                  ({se[j].toFixed(4)})
                </td>
                <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                  {tStat[j].toFixed(3)}
                  <span style={{ color: "#e53935", fontSize: 11, marginLeft: 2 }}>{sig}</span>
                </td>
                <td style={{ textAlign: "right", fontSize: 12, color: pVal[j] < 0.05 ? "var(--color-primary)" : "var(--color-text-muted)" }}>
                  {pVal[j] < 0.001 ? "<0.001" : pVal[j].toFixed(3)}
                </td>
                <td style={{ textAlign: "right", fontSize: 11, color: "var(--color-text-muted)" }}>
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
  const maxAbs = Math.max(...model.residuals.map(Math.abs), 0.1);
  const barH = 40;

  return (
    <div className="card" style={{ marginTop: 8 }}>
      <div className="section-title">残差分布 ê = Y - Xβ̂</div>
      <div style={{ padding: "4px 14px 12px" }}>
        {/* Histogram */}
        <ResidualHistogram residuals={model.residuals} />
        {/* Summary stats */}
        <div style={{ display: "flex", gap: 12, justifyContent: "center", marginTop: 8 }}>
          <MiniStat label="平均" value={mean(model.residuals).toFixed(4)} />
          <MiniStat label="標準偏差" value={Math.sqrt(model.sigmaHat2).toFixed(4)} />
          <MiniStat label="最小" value={Math.min(...model.residuals).toFixed(2)} />
          <MiniStat label="最大" value={Math.max(...model.residuals).toFixed(2)} />
        </div>
      </div>
    </div>
  );
}

function ResidualHistogram({ residuals }: { residuals: number[] }) {
  const bins = 12;
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
            background: "var(--color-primary)",
            opacity: 0.6,
            borderRadius: "2px 2px 0 0",
            minHeight: c > 0 ? 3 : 0,
          }}
        />
      ))}
    </div>
  );
}

function FittedChart({ model }: { model: OLSResult }) {
  // Scatter-like: show fitted vs actual as paired bars
  const Y = model.fitted.map((f, i) => ({ fitted: f, actual: f + model.residuals[i] }));
  Y.sort((a, b) => a.actual - b.actual);
  const maxVal = Math.max(...Y.map(d => Math.max(d.fitted, d.actual)), 0.1);

  return (
    <div className="card" style={{ marginTop: 8 }}>
      <div className="section-title">Ŷ vs Y (予測値 vs 実測値)</div>
      <div style={{ padding: "4px 14px 12px" }}>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 1, height: 60 }}>
          {Y.slice(0, 50).map((d, i) => (
            <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 0 }}>
              <div style={{
                width: "100%",
                height: Math.max(1, (d.actual / maxVal) * 56),
                background: "var(--color-primary)",
                opacity: 0.3,
                borderRadius: "2px 2px 0 0",
              }} />
              <div style={{
                width: "60%",
                height: Math.max(1, (d.fitted / maxVal) * 56),
                background: "#7c3aed",
                opacity: 0.7,
                borderRadius: "2px 2px 0 0",
                marginTop: -Math.max(1, (d.fitted / maxVal) * 56),
              }} />
            </div>
          ))}
        </div>
        <div style={{ display: "flex", justifyContent: "center", gap: 16, marginTop: 6 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 10, color: "var(--color-text-muted)" }}>
            <span style={{ width: 10, height: 10, background: "var(--color-primary)", opacity: 0.3, borderRadius: 2, display: "inline-block" }} />
            実測 Y
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 10, color: "var(--color-text-muted)" }}>
            <span style={{ width: 10, height: 10, background: "#7c3aed", opacity: 0.7, borderRadius: 2, display: "inline-block" }} />
            予測 Ŷ
          </div>
        </div>
      </div>
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
