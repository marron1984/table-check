/**
 * 名前表記ゆれの正規化
 * - 全角→半角英数
 * - 半角カナ→全角カナ
 * - 前後空白除去
 */
export function normalizeName(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let s = raw.trim();
  // 全角英数→半角英数
  s = s.replace(/[Ａ-Ｚａ-ｚ０-９]/g, (ch) =>
    String.fromCharCode(ch.charCodeAt(0) - 0xfee0)
  );
  // 半角カナ→全角カナ（簡易マッピング）
  const halfToFull: Record<string, string> = {
    ｱ: "ア", ｲ: "イ", ｳ: "ウ", ｴ: "エ", ｵ: "オ",
    ｶ: "カ", ｷ: "キ", ｸ: "ク", ｹ: "ケ", ｺ: "コ",
    ｻ: "サ", ｼ: "シ", ｽ: "ス", ｾ: "セ", ｿ: "ソ",
    ﾀ: "タ", ﾁ: "チ", ﾂ: "ツ", ﾃ: "テ", ﾄ: "ト",
    ﾅ: "ナ", ﾆ: "ニ", ﾇ: "ヌ", ﾈ: "ネ", ﾉ: "ノ",
    ﾊ: "ハ", ﾋ: "ヒ", ﾌ: "フ", ﾍ: "ヘ", ﾎ: "ホ",
    ﾏ: "マ", ﾐ: "ミ", ﾑ: "ム", ﾒ: "メ", ﾓ: "モ",
    ﾔ: "ヤ", ﾕ: "ユ", ﾖ: "ヨ",
    ﾗ: "ラ", ﾘ: "リ", ﾙ: "ル", ﾚ: "レ", ﾛ: "ロ",
    ﾜ: "ワ", ｦ: "ヲ", ﾝ: "ン",
    ﾞ: "゛", ﾟ: "゜", ｰ: "ー",
  };
  s = s.replace(/[ｱ-ﾝﾞﾟｰ]/g, (ch) => halfToFull[ch] || ch);
  return s || null;
}

/**
 * メールアドレスの正規化（小文字化）
 */
export function normalizeEmail(raw: string | null | undefined): string | null {
  if (!raw) return null;
  return raw.trim().toLowerCase() || null;
}

/**
 * プロファイル充足率を計算する（必須項目の入力率）
 */
export function calcProfileCompleteness(customer: {
  lastName?: string | null;
  firstName?: string | null;
  phone?: string | null;
  email?: string | null;
  lastNameKana?: string | null;
  allergies?: string | null;
  language?: string | null;
}): number {
  const fields = [
    customer.lastName,
    customer.firstName,
    customer.phone,
    customer.email,
    customer.lastNameKana,
    customer.allergies,
    customer.language,
  ];
  const filled = fields.filter((f) => f != null && f !== "").length;
  return Math.round((filled / fields.length) * 100) / 100;
}
