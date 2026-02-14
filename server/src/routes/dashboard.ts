import { Router } from "express";
import { prisma } from "../db";
import { authenticate, type AuthenticatedRequest } from "../middleware/auth";

const router = Router();

/**
 * GET /api/dashboard/stats
 * ダッシュボード統計
 */
router.get("/stats", authenticate, async (req: AuthenticatedRequest, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const shopFilter = req.staff && req.staff.shopIds.length > 0
      ? { shopId: { in: req.staff.shopIds } }
      : {};

    const [
      todayReservations,
      totalCustomers,
      pendingDuplicates,
      recentNoShows,
      vipCount,
    ] = await Promise.all([
      prisma.reservation.count({
        where: {
          dateTime: { gte: today, lt: tomorrow },
          status: { not: "CANCELLED" },
          ...shopFilter,
        },
      }),
      prisma.customer.count({ where: { mergedIntoId: null } }),
      prisma.duplicateCandidate.count({ where: { status: "PENDING" } }),
      prisma.reservation.count({
        where: {
          status: "NO_SHOW",
          dateTime: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
          ...shopFilter,
        },
      }),
      prisma.customerTag.count({
        where: {
          tagDefinition: { slug: { in: ["vip", "vvip"] } },
        },
      }),
    ]);

    // プロファイル充足率平均
    const profileStats = await prisma.customer.aggregate({
      where: { mergedIntoId: null, profileCompleteness: { not: null } },
      _avg: { profileCompleteness: true },
    });

    // 重複率
    const totalWithMerged = await prisma.customer.count();
    const mergedCount = await prisma.customer.count({ where: { mergedIntoId: { not: null } } });
    const duplicateRate = totalWithMerged > 0
      ? Math.round((mergedCount / totalWithMerged) * 100 * 10) / 10
      : 0;

    res.json({
      data: {
        todayReservations,
        totalCustomers,
        pendingDuplicates,
        recentNoShows,
        vipCount,
        avgProfileCompleteness: Math.round((profileStats._avg.profileCompleteness || 0) * 100),
        duplicateRate,
      },
    });
  } catch (error) {
    res.status(500).json({ error: "ダッシュボード情報の取得に失敗しました" });
  }
});

export default router;
