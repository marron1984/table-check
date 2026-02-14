import { StaffRole } from "@prisma/client";

/**
 * 個人情報マスキングヘルパー
 * ロールに応じて電話番号・メール等を部分表示にする
 */
export function maskCustomerData(
  customer: Record<string, unknown>,
  role: StaffRole
): Record<string, unknown> {
  // ADMIN, MANAGERは全項目閲覧可能
  if (role === "ADMIN" || role === "MANAGER") {
    return customer;
  }

  const masked = { ...customer };

  // 電話番号マスキング: 090-****-1234
  if (typeof masked.phone === "string" && masked.phone.length > 4) {
    const phone = masked.phone;
    masked.phone = phone.slice(0, 3) + "-****-" + phone.slice(-4);
  }

  // メールマスキング: t***@example.com
  if (typeof masked.email === "string" && masked.email.includes("@")) {
    const [local, domain] = (masked.email as string).split("@");
    masked.email = local[0] + "***@" + domain;
  }

  // FLOOR_STAFFは秘書情報を非表示
  if (role === "FLOOR_STAFF") {
    masked.secretaryPhone = null;
    masked.secretaryEmail = null;
  }

  // ANALYSTにはフル情報表示しない
  if (role === "ANALYST") {
    masked.phone = "***";
    masked.email = "***";
    masked.secretaryPhone = null;
    masked.secretaryEmail = null;
  }

  return masked;
}
