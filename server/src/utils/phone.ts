import { parsePhoneNumberFromString } from "libphonenumber-js";

/**
 * 電話番号を E.164 形式に正規化する。
 * 国番号がない場合はデフォルトで日本(JP)を想定。
 */
export function normalizePhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const cleaned = raw.replace(/[\s\-().]/g, "");
  if (!cleaned) return null;

  const parsed = parsePhoneNumberFromString(cleaned, "JP");
  if (parsed && parsed.isValid()) {
    return parsed.format("E.164");
  }
  // パースできなくても元の値（クリーン済み）を返す
  return cleaned;
}
