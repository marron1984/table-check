/**
 * 正規化ユーティリティ
 * Identity Resolution用
 */

/** 電話番号を正規化（国番号・記号除去） */
export function normalizePhone(phone: string | null | undefined): string | null {
  if (!phone) return null;
  // Remove all non-digit characters
  let digits = phone.replace(/[^\d]/g, "");
  // Remove leading country codes
  if (digits.startsWith("81") && digits.length > 10) {
    digits = "0" + digits.slice(2);
  } else if (digits.startsWith("+81")) {
    digits = "0" + digits.slice(3);
  }
  // Must be at least 10 digits to be valid
  if (digits.length < 10) return null;
  return digits;
}

/** メールアドレスを正規化（小文字化、空白除去） */
export function normalizeEmail(email: string | null | undefined): string | null {
  if (!email) return null;
  const trimmed = email.trim().toLowerCase();
  if (!trimmed.includes("@")) return null;
  return trimmed;
}

/** 名前の正規化（全角→半角スペース、前後空白除去） */
export function normalizeName(name: string): string {
  return name
    .replace(/\u3000/g, " ")  // full-width space → half-width
    .replace(/\s+/g, " ")
    .trim();
}

/** 名前の類似度スコア（0-1） シンプルな文字一致率 */
export function nameSimilarity(a: string, b: string): number {
  const na = normalizeName(a).toLowerCase();
  const nb = normalizeName(b).toLowerCase();
  if (na === nb) return 1.0;
  if (!na || !nb) return 0;

  // Jaccard similarity on character bigrams
  const bigramsA = new Set<string>();
  const bigramsB = new Set<string>();
  for (let i = 0; i < na.length - 1; i++) bigramsA.add(na.slice(i, i + 2));
  for (let i = 0; i < nb.length - 1; i++) bigramsB.add(nb.slice(i, i + 2));

  if (bigramsA.size === 0 || bigramsB.size === 0) return 0;

  let intersection = 0;
  bigramsA.forEach((bg) => {
    if (bigramsB.has(bg)) intersection++;
  });

  return intersection / (bigramsA.size + bigramsB.size - intersection);
}
