import { prisma } from "../db";
import { logger } from "../logger";

/**
 * 顧客のスコアを再計算する
 * - LTV推定
 * - 再来店確率（90日/180日）
 * - キャンセルリスク
 */
export async function recalculateScores(customerId: string): Promise<void> {
  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
    include: {
      reservations: {
        orderBy: { dateTime: "desc" },
      },
    },
  });

  if (!customer || customer.mergedIntoId) return;

  const now = new Date();
  const completedReservations = customer.reservations.filter(
    (r) => r.status === "COMPLETED" || r.status === "SEATED"
  );
  const allReservations = customer.reservations;

  // --- LTV推定 ---
  // 過去の総額 × 再来店確率で推定
  const totalSpend = completedReservations.reduce((sum, r) => sum + (r.totalAmount || 0), 0);
  const avgSpendPerVisit = completedReservations.length > 0
    ? totalSpend / completedReservations.length
    : 0;

  // 年間来店頻度
  const firstVisit = completedReservations[completedReservations.length - 1]?.dateTime;
  let annualFrequency = 0;
  if (firstVisit && completedReservations.length > 1) {
    const daysSinceFirst = Math.max(
      1,
      (now.getTime() - firstVisit.getTime()) / (1000 * 60 * 60 * 24)
    );
    annualFrequency = (completedReservations.length / daysSinceFirst) * 365;
  }

  // LTV = 平均単価 × 年間頻度 × 推定残存年数(3年)
  const ltvScore = Math.round(avgSpendPerVisit * annualFrequency * 3);

  // --- 再来店確率 ---
  // 簡易モデル: 最終来店からの経過日数による減衰
  const lastVisit = completedReservations[0]?.dateTime;
  let returnProbability90 = 0;
  let returnProbability180 = 0;

  if (lastVisit) {
    const daysSince = (now.getTime() - lastVisit.getTime()) / (1000 * 60 * 60 * 24);
    // ロジスティック関数ベースの簡易推定
    returnProbability90 = Math.round(100 / (1 + Math.exp((daysSince - 60) / 20))) / 100;
    returnProbability180 = Math.round(100 / (1 + Math.exp((daysSince - 120) / 40))) / 100;
  }

  // --- キャンセルリスク ---
  const cancellations = allReservations.filter((r) => r.status === "CANCELLED" || r.status === "NO_SHOW");
  const cancelRisk = allReservations.length > 0
    ? Math.round((cancellations.length / allReservations.length) * 100) / 100
    : 0;

  // lastVisitAt更新
  const lastVisitAt = lastVisit || null;

  await prisma.customer.update({
    where: { id: customerId },
    data: {
      ltvScore,
      returnProbability90,
      returnProbability180,
      cancelRisk,
      lastVisitAt,
    },
  });

  logger.debug(`Recalculated scores for customer ${customerId}`, {
    ltvScore,
    returnProbability90,
    returnProbability180,
    cancelRisk,
  });
}
