/**
 * ミクロ計量分析エンジン
 *
 * 末石直也 (2025) 「ミクロ計量分析」講義資料に基づく実装:
 * - 線形回帰モデル: Y = Xβ + e, E[e|X] = 0
 * - OLS推定量: β̂ = (X'X)⁻¹X'Y
 * - 均一分散の標準誤差: se₀(β̂ⱼ) = √(s²[(X'X)⁻¹]ⱼⱼ)
 * - Whiteのロバスト標準誤差 (White 1980): V̂ = (X'X/n)⁻¹ (Σê²ᵢXᵢXᵢ'/n) (X'X/n)⁻¹
 * - t統計量: Tⱼ = (β̂ⱼ - βⱼ₀) / se(β̂ⱼ)
 * - 信頼区間: [β̂ⱼ ± t_{n-k,1-α/2} · se(β̂ⱼ)]
 *
 * References:
 * - White, H. (1980): Econometrica, 48, 817–838.
 * - Hansen, B. E. (2022): Econometrics, Princeton University Press.
 */

// ============================================================
// Types
// ============================================================
export interface OLSResult {
  varNames: string[];       // variable names (including intercept)
  beta: number[];           // β̂ coefficient estimates
  se: number[];             // homoskedastic standard errors
  seRobust: number[];       // White's robust standard errors (HC0)
  tStat: number[];          // t-statistics (homoskedastic)
  tStatRobust: number[];    // t-statistics (robust)
  pValue: number[];         // p-values (homoskedastic)
  pValueRobust: number[];   // p-values (robust)
  ci95: [number, number][];         // 95% CI (homoskedastic)
  ci95Robust: [number, number][];   // 95% CI (robust)
  r2: number;               // R²
  adjR2: number;            // Adjusted R²
  sigmaHat2: number;        // σ̂² = Σêᵢ²/(n-k)
  n: number;                // sample size
  k: number;                // number of regressors (including intercept)
  residuals: number[];      // ê = Y - Xβ̂
  fitted: number[];         // Ŷ = Xβ̂
  yMean: number;            // Ȳ
  depVar: string;           // dependent variable name
}

export interface RegressionSpec {
  depVar: string;
  depVarLabel: string;
  indepVars: string[];
  indepVarLabels: string[];
}

// ============================================================
// Matrix operations
// ============================================================

/** Transpose matrix */
function transpose(A: number[][]): number[][] {
  const m = A.length, n = A[0].length;
  const result: number[][] = Array.from({ length: n }, () => new Array(m));
  for (let i = 0; i < m; i++)
    for (let j = 0; j < n; j++)
      result[j][i] = A[i][j];
  return result;
}

/** Multiply two matrices */
function matmul(A: number[][], B: number[][]): number[][] {
  const m = A.length, n = B[0].length, p = B.length;
  const result: number[][] = Array.from({ length: m }, () => new Array(n).fill(0));
  for (let i = 0; i < m; i++)
    for (let j = 0; j < n; j++)
      for (let l = 0; l < p; l++)
        result[i][j] += A[i][l] * B[l][j];
  return result;
}

/** Matrix × vector */
function matvec(A: number[][], x: number[]): number[] {
  return A.map(row => row.reduce((s, a, j) => s + a * x[j], 0));
}

/** Invert a small k×k matrix via Gauss-Jordan elimination */
function invert(A: number[][]): number[][] {
  const n = A.length;
  // Augment with identity
  const aug: number[][] = A.map((row, i) => {
    const r = [...row];
    for (let j = 0; j < n; j++) r.push(i === j ? 1 : 0);
    return r;
  });

  for (let col = 0; col < n; col++) {
    // Partial pivoting
    let maxRow = col;
    for (let row = col + 1; row < n; row++) {
      if (Math.abs(aug[row][col]) > Math.abs(aug[maxRow][col])) maxRow = row;
    }
    [aug[col], aug[maxRow]] = [aug[maxRow], aug[col]];

    const pivot = aug[col][col];
    if (Math.abs(pivot) < 1e-12) throw new Error("Singular matrix");

    for (let j = 0; j < 2 * n; j++) aug[col][j] /= pivot;

    for (let row = 0; row < n; row++) {
      if (row === col) continue;
      const factor = aug[row][col];
      for (let j = 0; j < 2 * n; j++) aug[row][j] -= factor * aug[col][j];
    }
  }

  return aug.map(row => row.slice(n));
}

// ============================================================
// Statistical distributions (approximations)
// ============================================================

/** Standard normal CDF (Abramowitz & Stegun approximation) */
function normalCdf(x: number): number {
  const a1 = 0.254829592, a2 = -0.284496736, a3 = 1.421413741;
  const a4 = -1.453152027, a5 = 1.061405429, p = 0.3275911;
  const sign = x < 0 ? -1 : 1;
  const t = 1 / (1 + p * Math.abs(x));
  const y = 1 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x / 2);
  return 0.5 * (1 + sign * y);
}

/** Two-tailed p-value from t-statistic using normal approximation
 *  (valid for n-k >> 30, which holds for our n≈100 case) */
function twoTailP(tStat: number, _df: number): number {
  // For large df, t-distribution ≈ N(0,1)
  // For small df we'd need a proper t-distribution, but n-k ≈ 96 is large enough
  return 2 * (1 - normalCdf(Math.abs(tStat)));
}

/** Critical value z_{1-α/2} for α=0.05: z_{0.975} ≈ 1.96 */
const Z_975 = 1.96;

/** t-distribution critical value approximation for df > 30 */
function tCritical(_df: number): number {
  // t_{n-k, 0.975} ≈ 1.96 for large df; for df=96 it's ≈1.985
  // Use simple approximation: t ≈ z + (z³+z)/(4·df)
  const z = Z_975;
  if (_df > 200) return z;
  return z + (z * z * z + z) / (4 * _df);
}

// ============================================================
// OLS Estimation
// ============================================================

/**
 * OLS推定を実行
 *
 * Yi = Xi'β + ei, E[ei|Xi] = 0
 * β̂ = (X'X)⁻¹X'Y   ... (式3)
 *
 * @param Y - 被説明変数ベクトル (n×1)
 * @param X_raw - 説明変数行列 (n×(k-1), intercept is added automatically)
 * @param varNames - 変数名 (k-1 names, "定数項" added automatically)
 * @param depVar - 被説明変数名
 */
export function ols(
  Y: number[],
  X_raw: number[][],
  varNames: string[],
  depVar: string,
): OLSResult {
  const n = Y.length;
  const k = X_raw[0].length + 1; // +1 for intercept

  // Build X with intercept column
  const X: number[][] = X_raw.map(row => [1, ...row]);
  const allVarNames = ["定数項", ...varNames];

  // β̂ = (X'X)⁻¹X'Y  ... 式(10)
  const Xt = transpose(X);
  const XtX = matmul(Xt, X);         // X'X  (k×k)
  const XtX_inv = invert(XtX);       // (X'X)⁻¹
  const XtY = matvec(Xt, Y);         // X'Y  (k×1)
  const beta = matvec(XtX_inv, XtY); // β̂ = (X'X)⁻¹X'Y

  // Fitted values and residuals
  // Ŷ = Xβ̂ = PY  ... 式(11)
  // ê = Y - Ŷ = MY  ... 式(12)
  const fitted = matvec(X, beta);
  const residuals = Y.map((y, i) => y - fitted[i]);

  // σ̂² = (1/(n-k)) Σêᵢ²  ... 式(28)
  const ssr = residuals.reduce((s, e) => s + e * e, 0);
  const sigmaHat2 = ssr / (n - k);

  // === 均一分散の標準誤差 ===
  // V̂₀ = s²(X'X)⁻¹  ... 式(29)
  // se₀(β̂ⱼ) = √(s²[(X'X)⁻¹]ⱼⱼ)  ... 式(30)
  const se = allVarNames.map((_, j) => Math.sqrt(sigmaHat2 * XtX_inv[j][j]));

  // === Whiteのロバスト標準誤差 (HC0) ===
  // V̂ = (X'X/n)⁻¹ · (1/n)Σêᵢ²XᵢXᵢ' · (X'X/n)⁻¹  ... 式(44)
  // Simplified: V̂ = (X'X)⁻¹ · Σêᵢ²XᵢXᵢ' · (X'X)⁻¹
  //
  // White (1980): heteroskedasticity-consistent covariance matrix estimator

  // Compute Σêᵢ²XᵢXᵢ'
  const meat: number[][] = Array.from({ length: k }, () => new Array(k).fill(0));
  for (let i = 0; i < n; i++) {
    const e2 = residuals[i] * residuals[i];
    for (let j = 0; j < k; j++) {
      for (let l = 0; l < k; l++) {
        meat[j][l] += e2 * X[i][j] * X[i][l];
      }
    }
  }

  // V̂_White = (X'X)⁻¹ · meat · (X'X)⁻¹
  const sandwich = matmul(matmul(XtX_inv, meat), XtX_inv);
  const seRobust = allVarNames.map((_, j) => Math.sqrt(sandwich[j][j]));

  // === t統計量 ===
  // Tⱼ = (β̂ⱼ - βⱼ₀) / se(β̂ⱼ),  H₀: βⱼ = 0  ... 式(5)
  const df = n - k;
  const tStat = beta.map((b, j) => b / se[j]);
  const tStatRobust = beta.map((b, j) => b / seRobust[j]);

  // p-values
  const pValue = tStat.map(t => twoTailP(t, df));
  const pValueRobust = tStatRobust.map(t => twoTailP(t, df));

  // === 信頼区間 ===
  // [β̂ⱼ ± t_{n-k,1-α/2} · se(β̂ⱼ)]  ... 式(36)/(48)
  const tc = tCritical(df);
  const ci95: [number, number][] = beta.map((b, j) => [b - tc * se[j], b + tc * se[j]]);
  const ci95Robust: [number, number][] = beta.map((b, j) => [b - tc * seRobust[j], b + tc * seRobust[j]]);

  // R² and Adjusted R²
  const yMean = Y.reduce((s, y) => s + y, 0) / n;
  const sst = Y.reduce((s, y) => s + (y - yMean) ** 2, 0);
  const r2 = sst > 0 ? 1 - ssr / sst : 0;
  const adjR2 = 1 - (1 - r2) * (n - 1) / (n - k);

  return {
    varNames: allVarNames,
    beta,
    se,
    seRobust,
    tStat,
    tStatRobust,
    pValue,
    pValueRobust,
    ci95,
    ci95Robust,
    r2,
    adjR2,
    sigmaHat2,
    n,
    k,
    residuals,
    fitted,
    yMean,
    depVar,
  };
}
