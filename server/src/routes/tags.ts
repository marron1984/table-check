import { Router, type Response } from "express";
import { prisma } from "../db";
import { authenticate, requireRole, type AuthenticatedRequest } from "../middleware/auth";
import { auditLog } from "../middleware/audit";

const router = Router();

/**
 * GET /api/tags
 * タグ一覧
 */
router.get("/", authenticate, async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const tags = await prisma.tagDefinition.findMany({
      orderBy: [{ category: "asc" }, { priority: "desc" }],
      include: {
        _count: { select: { customerTags: true } },
      },
    });
    res.json({ data: tags });
  } catch (error) {
    res.status(500).json({ error: "タグ一覧の取得に失敗しました" });
  }
});

/**
 * POST /api/tags/:tagId/customers/:customerId
 * 手動タグ付与
 */
router.post(
  "/:tagId/customers/:customerId",
  authenticate,
  requireRole("ADMIN", "MANAGER", "RESERVATION_STAFF"),
  auditLog("tag"),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const tag = await prisma.customerTag.upsert({
        where: {
          customerId_tagDefinitionId: {
            customerId: req.params.customerId,
            tagDefinitionId: req.params.tagId,
          },
        },
        create: {
          customerId: req.params.customerId,
          tagDefinitionId: req.params.tagId,
          assignedBy: req.staff!.id,
        },
        update: {
          assignedBy: req.staff!.id,
        },
      });
      res.json({ data: tag });
    } catch (error) {
      res.status(500).json({ error: "タグ付与に失敗しました" });
    }
  }
);

/**
 * DELETE /api/tags/:tagId/customers/:customerId
 * タグ解除
 */
router.delete(
  "/:tagId/customers/:customerId",
  authenticate,
  requireRole("ADMIN", "MANAGER"),
  auditLog("tag"),
  async (_req: AuthenticatedRequest, res: Response) => {
    try {
      await prisma.customerTag.delete({
        where: {
          customerId_tagDefinitionId: {
            customerId: _req.params.customerId,
            tagDefinitionId: _req.params.tagId,
          },
        },
      });
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "タグ解除に失敗しました" });
    }
  }
);

export default router;
