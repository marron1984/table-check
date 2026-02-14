import { AlertSeverity } from "@prisma/client";
import { prisma } from "../db";
import { logger } from "../logger";

/**
 * 予約に対してアラートを生成する
 * - 重大アレルギー
 * - VIP
 * - ノーショー注意
 * - 記念日（当日含む前後14日）
 */
export async function generateReservationAlerts(reservationId: string): Promise<void> {
  const reservation = await prisma.reservation.findUnique({
    where: { id: reservationId },
    include: {
      customer: {
        include: {
          tags: { include: { tagDefinition: true } },
        },
      },
    },
  });

  if (!reservation || !reservation.customer) return;

  const customer = reservation.customer;
  const tagSlugs = customer.tags.map((t) => t.tagDefinition.slug);
  const alertsToCreate: Array<{
    severity: AlertSeverity;
    alertType: string;
    message: string;
  }> = [];

  // 重大アレルギー
  if (tagSlugs.includes("allergy-critical")) {
    let allergyDetail = "";
    if (customer.allergies) {
      try {
        const allergies = JSON.parse(customer.allergies);
        allergyDetail = allergies
          .filter((a: { severity?: string }) => a.severity === "critical" || a.severity === "high")
          .map((a: { name: string }) => a.name)
          .join(", ");
      } catch { /* ignore */ }
    }
    alertsToCreate.push({
      severity: "CRITICAL",
      alertType: "allergy",
      message: `重大アレルギー注意${allergyDetail ? `: ${allergyDetail}` : ""}`,
    });
  } else if (tagSlugs.includes("allergy-mild")) {
    alertsToCreate.push({
      severity: "MEDIUM",
      alertType: "allergy",
      message: "アレルギー情報あり（詳細は顧客カードを確認）",
    });
  }

  // VIP
  if (tagSlugs.includes("vvip")) {
    alertsToCreate.push({
      severity: "HIGH",
      alertType: "vip",
      message: "VVIP顧客です",
    });
  } else if (tagSlugs.includes("vip")) {
    alertsToCreate.push({
      severity: "HIGH",
      alertType: "vip",
      message: "VIP顧客です",
    });
  }

  // ノーショー注意
  if (tagSlugs.includes("no-show-risk")) {
    alertsToCreate.push({
      severity: "HIGH",
      alertType: "no_show_risk",
      message: "ノーショー履歴あり（確認連絡推奨）",
    });
  }

  // 記念日（前後14日）
  if (reservation.occasion && /記念日|anniversary|birthday|誕生日/i.test(reservation.occasion)) {
    alertsToCreate.push({
      severity: "MEDIUM",
      alertType: "anniversary",
      message: `記念日: ${reservation.occasion}`,
    });
  }

  // 法人・接待
  if (tagSlugs.includes("corporate") && reservation.occasion?.includes("接待")) {
    alertsToCreate.push({
      severity: "MEDIUM",
      alertType: "corporate",
      message: `法人接待（${customer.companyName || "企業名不明"}）`,
    });
  }

  // 既存アラートを削除して再生成
  await prisma.reservationAlert.deleteMany({ where: { reservationId } });

  for (const alert of alertsToCreate) {
    await prisma.reservationAlert.create({
      data: {
        reservationId,
        ...alert,
      },
    });
  }

  if (alertsToCreate.length > 0) {
    logger.debug(`Generated ${alertsToCreate.length} alerts for reservation ${reservationId}`);
  }
}
