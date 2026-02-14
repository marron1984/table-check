import { Router } from "express";
import { prisma } from "../db";
import { authenticate, type AuthenticatedRequest } from "../middleware/auth";
import { auditLog } from "../middleware/audit";

const router = Router();

/**
 * GET /api/reservations/today
 * 当日予約一覧（アラート付き）
 */
router.get("/today", authenticate, auditLog("reservation"), async (req: AuthenticatedRequest, res) => {
  try {
    const { shopId } = req.query;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const where: Record<string, unknown> = {
      dateTime: { gte: today, lt: tomorrow },
      status: { not: "CANCELLED" },
    };

    if (shopId) {
      where.shopId = shopId;
    } else if (req.staff && req.staff.shopIds.length > 0) {
      where.shopId = { in: req.staff.shopIds };
    }

    const reservations = await prisma.reservation.findMany({
      where,
      include: {
        customer: {
          include: {
            tags: { include: { tagDefinition: true } },
          },
        },
        shop: true,
        alerts: { orderBy: { severity: "asc" } },
      },
      orderBy: { dateTime: "asc" },
    });

    res.json({ data: reservations, count: reservations.length });
  } catch (error) {
    res.status(500).json({ error: "予約一覧の取得に失敗しました" });
  }
});

/**
 * GET /api/reservations/:id
 * 予約詳細
 */
router.get("/:id", authenticate, auditLog("reservation"), async (req: AuthenticatedRequest, res) => {
  try {
    const reservation = await prisma.reservation.findUnique({
      where: { id: req.params.id },
      include: {
        customer: {
          include: {
            tags: { include: { tagDefinition: true } },
            reservations: {
              orderBy: { dateTime: "desc" },
              take: 10,
              include: { shop: true },
            },
          },
        },
        shop: true,
        alerts: { orderBy: { severity: "asc" } },
      },
    });

    if (!reservation) {
      res.status(404).json({ error: "予約が見つかりません" });
      return;
    }

    // 顧客閲覧ログ
    if (reservation.customerId && req.staff) {
      await prisma.auditLog.create({
        data: {
          staffId: req.staff.id,
          action: "view",
          objectType: "customer",
          objectId: reservation.customerId,
          customerId: reservation.customerId,
          ipAddress: req.ip || null,
        },
      });
    }

    res.json({ data: reservation });
  } catch (error) {
    res.status(500).json({ error: "予約詳細の取得に失敗しました" });
  }
});

/**
 * GET /api/reservations
 * 予約検索（日付範囲, 店舗, ステータス）
 */
router.get("/", authenticate, async (req: AuthenticatedRequest, res) => {
  try {
    const { shopId, from, to, status, page = "1", limit = "50" } = req.query;

    const where: Record<string, unknown> = {};
    if (shopId) where.shopId = shopId;
    if (status) where.status = status;
    if (from || to) {
      where.dateTime = {};
      if (from) (where.dateTime as Record<string, unknown>).gte = new Date(from as string);
      if (to) (where.dateTime as Record<string, unknown>).lte = new Date(to as string);
    }

    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);
    const take = parseInt(limit as string);

    const [reservations, total] = await Promise.all([
      prisma.reservation.findMany({
        where,
        include: {
          customer: { include: { tags: { include: { tagDefinition: true } } } },
          shop: true,
          alerts: true,
        },
        orderBy: { dateTime: "desc" },
        skip,
        take,
      }),
      prisma.reservation.count({ where }),
    ]);

    res.json({
      data: reservations,
      pagination: {
        page: parseInt(page as string),
        limit: take,
        total,
        totalPages: Math.ceil(total / take),
      },
    });
  } catch (error) {
    res.status(500).json({ error: "予約の検索に失敗しました" });
  }
});

export default router;
