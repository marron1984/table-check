import { Router } from "express";
import { prisma } from "../db";
import { authenticate, requireRole, type AuthenticatedRequest } from "../middleware/auth";
import { auditLog } from "../middleware/audit";
import { maskCustomerData } from "../middleware/masking";
import { normalizePhone } from "../utils";
import { mergeCustomers, rejectDuplicate } from "../services/customer-merge";

const router = Router();

/**
 * GET /api/customers/search
 * 顧客検索（電話・名前・タグ）
 * 要件: 3秒以内にヒット
 */
router.get("/search", authenticate, auditLog("customer"), async (req: AuthenticatedRequest, res) => {
  try {
    const { q, tag, page = "1", limit = "20" } = req.query;
    const query = (q as string)?.trim();

    if (!query && !tag) {
      res.status(400).json({ error: "検索条件を指定してください" });
      return;
    }

    const where: Record<string, unknown> = {
      mergedIntoId: null,
    };

    if (query) {
      const normalizedPhone = normalizePhone(query);
      where.OR = [
        { phoneNormalized: normalizedPhone || undefined },
        { phone: { contains: query } },
        { email: { contains: query, mode: "insensitive" } },
        { lastName: { contains: query } },
        { firstName: { contains: query } },
        { lastNameKana: { contains: query } },
        { firstNameKana: { contains: query } },
        { lastNameEn: { contains: query, mode: "insensitive" } },
        { firstNameEn: { contains: query, mode: "insensitive" } },
        { companyName: { contains: query } },
      ].filter((c) => {
        const values = Object.values(c);
        return values.every((v) => v !== undefined);
      });
    }

    if (tag) {
      where.tags = {
        some: { tagDefinition: { slug: tag } },
      };
    }

    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);
    const take = parseInt(limit as string);

    const [customers, total] = await Promise.all([
      prisma.customer.findMany({
        where,
        include: {
          tags: { include: { tagDefinition: true } },
          _count: { select: { reservations: true } },
        },
        orderBy: { updatedAt: "desc" },
        skip,
        take,
      }),
      prisma.customer.count({ where }),
    ]);

    const maskedCustomers = customers.map((c) =>
      maskCustomerData(c as unknown as Record<string, unknown>, req.staff!.role)
    );

    res.json({
      data: maskedCustomers,
      pagination: {
        page: parseInt(page as string),
        limit: take,
        total,
        totalPages: Math.ceil(total / take),
      },
    });
  } catch (error) {
    res.status(500).json({ error: "顧客検索に失敗しました" });
  }
});

/**
 * GET /api/customers/:id
 * 顧客詳細（タイムライン＋嗜好＋注意）
 */
router.get("/:id", authenticate, auditLog("customer"), async (req: AuthenticatedRequest, res) => {
  try {
    const customer = await prisma.customer.findUnique({
      where: { id: req.params.id },
      include: {
        tags: {
          include: { tagDefinition: true },
          orderBy: { tagDefinition: { priority: "desc" } },
        },
        reservations: {
          orderBy: { dateTime: "desc" },
          take: 50,
          include: { shop: true, alerts: true },
        },
        memberships: true,
        mergedFrom: {
          select: { id: true, tableCheckId: true, lastName: true, firstName: true },
        },
      },
    });

    if (!customer) {
      res.status(404).json({ error: "顧客が見つかりません" });
      return;
    }

    // マージ先がある場合はリダイレクト情報を付与
    if (customer.mergedIntoId) {
      res.json({
        data: null,
        mergedInto: customer.mergedIntoId,
        message: "この顧客は統合されています",
      });
      return;
    }

    // 閲覧ログ
    if (req.staff) {
      await prisma.auditLog.create({
        data: {
          staffId: req.staff.id,
          action: "view",
          objectType: "customer",
          objectId: customer.id,
          customerId: customer.id,
          ipAddress: req.ip || null,
        },
      });
    }

    const masked = maskCustomerData(
      customer as unknown as Record<string, unknown>,
      req.staff!.role
    );

    res.json({ data: masked });
  } catch (error) {
    res.status(500).json({ error: "顧客詳細の取得に失敗しました" });
  }
});

/**
 * PATCH /api/customers/:id
 * 顧客情報の更新（嗜好・メモ等）
 */
router.patch("/:id", authenticate, requireRole("ADMIN", "MANAGER", "RESERVATION_STAFF"), auditLog("customer"), async (req: AuthenticatedRequest, res) => {
  try {
    const allowedFields = [
      "allergies", "dietaryRestrictions", "preferences", "internalNote",
      "companyName", "companyRole", "secretaryName", "secretaryPhone", "secretaryEmail",
      "referrerName", "conciergeName", "conciergeSource",
    ];

    const updates: Record<string, unknown> = {};
    for (const field of allowedFields) {
      if (field in req.body) {
        updates[field] = req.body[field];
      }
    }

    if (Object.keys(updates).length === 0) {
      res.status(400).json({ error: "更新項目が指定されていません" });
      return;
    }

    // 変更履歴を記録
    const existing = await prisma.customer.findUnique({ where: { id: req.params.id } });
    if (!existing) {
      res.status(404).json({ error: "顧客が見つかりません" });
      return;
    }

    for (const [field, newValue] of Object.entries(updates)) {
      const oldValue = (existing as Record<string, unknown>)[field];
      if (oldValue !== newValue) {
        await prisma.customerHistory.create({
          data: {
            customerId: req.params.id,
            field,
            oldValue: oldValue != null ? String(oldValue) : null,
            newValue: newValue != null ? String(newValue) : null,
            changedBy: req.staff!.id,
          },
        });
      }
    }

    const updated = await prisma.customer.update({
      where: { id: req.params.id },
      data: updates,
    });

    res.json({ data: updated });
  } catch (error) {
    res.status(500).json({ error: "顧客情報の更新に失敗しました" });
  }
});

/**
 * GET /api/customers/duplicates
 * 重複統合キュー（管理者のみ）
 */
router.get("/duplicates/queue", authenticate, requireRole("ADMIN", "MANAGER"), async (req: AuthenticatedRequest, res) => {
  try {
    const { page = "1", limit = "20" } = req.query;
    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);
    const take = parseInt(limit as string);

    const [candidates, total] = await Promise.all([
      prisma.duplicateCandidate.findMany({
        where: { status: "PENDING" },
        include: {
          primary: {
            include: { tags: { include: { tagDefinition: true } } },
          },
          secondary: {
            include: { tags: { include: { tagDefinition: true } } },
          },
        },
        orderBy: { confidenceScore: "desc" },
        skip,
        take,
      }),
      prisma.duplicateCandidate.count({ where: { status: "PENDING" } }),
    ]);

    res.json({
      data: candidates,
      pagination: {
        page: parseInt(page as string),
        limit: take,
        total,
        totalPages: Math.ceil(total / take),
      },
    });
  } catch (error) {
    res.status(500).json({ error: "重複候補の取得に失敗しました" });
  }
});

/**
 * POST /api/customers/duplicates/:id/merge
 * 手動マージ実行
 */
router.post("/duplicates/:id/merge", authenticate, requireRole("ADMIN", "MANAGER"), auditLog("customer"), async (req: AuthenticatedRequest, res) => {
  try {
    const duplicate = await prisma.duplicateCandidate.findUnique({
      where: { id: req.params.id },
    });

    if (!duplicate || duplicate.status !== "PENDING") {
      res.status(404).json({ error: "対象の重複候補が見つかりません" });
      return;
    }

    await mergeCustomers(duplicate.primaryId, duplicate.secondaryId, req.staff!.id);
    res.json({ success: true, message: "顧客を統合しました" });
  } catch (error) {
    res.status(500).json({ error: "顧客統合に失敗しました" });
  }
});

/**
 * POST /api/customers/duplicates/:id/reject
 * 重複候補を却下
 */
router.post("/duplicates/:id/reject", authenticate, requireRole("ADMIN", "MANAGER"), auditLog("customer"), async (req: AuthenticatedRequest, res) => {
  try {
    await rejectDuplicate(req.params.id, req.staff!.id);
    res.json({ success: true, message: "重複候補を却下しました" });
  } catch (error) {
    res.status(500).json({ error: "却下に失敗しました" });
  }
});

export default router;
