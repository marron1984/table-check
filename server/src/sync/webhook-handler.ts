import { logger } from "../logger";
import type { TCSyncEvent } from "../tablecheck";
import { syncCustomerById } from "./customer-sync";
import { syncReservationById } from "./reservation-sync";
import { syncShops } from "./shop-sync";

/**
 * Sync API Webhook ハンドラ
 *
 * TableCheck Sync APIからの通知を受けて、該当オブジェクトをCRM APIで再取得しUpsertする。
 * 同じイベントが来ても同じ状態に収束する設計（冪等性）。
 */
export async function handleSyncEvent(event: TCSyncEvent): Promise<void> {
  logger.info("Processing sync event", {
    objectType: event.object_type,
    objectId: event.object_id,
    action: event.action,
  });

  try {
    switch (event.object_type) {
      case "customer":
        if (event.action === "delete") {
          logger.info(`Customer deleted in TableCheck: ${event.object_id} (soft-handled)`);
          // 削除はソフトデリートとして扱う（データ保持）
          break;
        }
        await syncCustomerById(event.object_id);
        break;

      case "reservation":
        if (event.action === "delete") {
          logger.info(`Reservation deleted in TableCheck: ${event.object_id} (soft-handled)`);
          break;
        }
        await syncReservationById(event.object_id);
        break;

      case "shop":
        await syncShops();
        break;

      default:
        logger.warn(`Unknown sync object type: ${event.object_type}`);
    }
  } catch (error) {
    logger.error("Sync event processing failed", {
      event,
      error: (error as Error).message,
    });
    throw error;
  }
}
