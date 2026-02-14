import { Router, type Request, type Response } from "express";
import crypto from "crypto";
import { config } from "../config";
import { logger } from "../logger";
import { prisma } from "../db";
import { handleSyncEvent } from "../sync";
import { backfillCustomers, backfillReservations, syncShops } from "../sync";
import { authenticate, requireRole, type AuthenticatedRequest } from "../middleware/auth";
import type { TCSyncEvent } from "../tablecheck";

const router = Router();

/**
 * POST /api/sync/webhook
 * TableCheck Sync API Webhook受信エンドポイント
 */
router.post("/webhook", async (req: Request, res: Response) => {
  // Webhook署名検証
  const signature = req.headers["x-tablecheck-signature"] as string;
  if (config.tableCheck.syncWebhookSecret && signature) {
    const expected = crypto
      .createHmac("sha256", config.tableCheck.syncWebhookSecret)
      .update(JSON.stringify(req.body))
      .digest("hex");

    if (signature !== expected) {
      res.status(401).json({ error: "Invalid signature" });
      return;
    }
  }

  const events: TCSyncEvent[] = Array.isArray(req.body) ? req.body : [req.body];

  // 非同期で処理（即座にACK返す）
  res.status(200).json({ received: events.length });

  for (const event of events) {
    try {
      await handleSyncEvent(event);
    } catch {
      // エラーはhandleSyncEvent内でログ済み
    }
  }
});

/**
 * POST /api/sync/backfill
 * 手動バックフィル実行（管理者のみ）
 */
router.post("/backfill", authenticate, requireRole("ADMIN"), async (_req: AuthenticatedRequest, res: Response) => {
  // デモ環境: TableCheck APIキーが未設定の場合はスキップ
  if (!config.tableCheck.apiKey) {
    // SyncStateのlastSyncAtを更新して「同期済み」に見せる
    const now = new Date();
    for (const objectType of ["customer", "reservation", "shop"]) {
      await prisma.syncState.upsert({
        where: { objectType },
        update: { lastSyncAt: now, status: "idle" },
        create: { objectType, lastSyncAt: now, status: "idle", recordsSynced: 0 },
      });
    }
    res.json({ message: "デモ環境: 同期ステータスを更新しました" });
    return;
  }

  try {
    // 非同期で実行開始
    res.json({ message: "バックフィルを開始しました" });

    await syncShops();
    await backfillCustomers();
    await backfillReservations();
  } catch (error) {
    logger.error("Backfill failed", { error: (error as Error).message });
  }
});

/**
 * GET /api/sync/status
 * 同期ステータス確認
 */
router.get("/status", authenticate, async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const states = await prisma.syncState.findMany();
    res.json({ data: states });
  } catch (error) {
    res.status(500).json({ error: "同期ステータスの取得に失敗しました" });
  }
});

export default router;
