import { ReservationStatus } from "@prisma/client";
import { prisma } from "../db";
import { logger } from "../logger";
import { tableCheckClient, type TCReservation } from "../tablecheck";
import { generateReservationAlerts } from "../services/alerts";

function mapStatus(tcStatus: string): ReservationStatus {
  const mapping: Record<string, ReservationStatus> = {
    confirmed: "CONFIRMED",
    seated: "SEATED",
    completed: "COMPLETED",
    cancelled: "CANCELLED",
    no_show: "NO_SHOW",
  };
  return mapping[tcStatus.toLowerCase()] || "CONFIRMED";
}

function mapReservationData(tc: TCReservation, shopInternalId: string, customerInternalId: string | null) {
  return {
    shopId: shopInternalId,
    customerId: customerInternalId,
    dateTime: new Date(tc.date_time),
    partySize: tc.party_size,
    status: mapStatus(tc.status),
    courseName: tc.course_name || null,
    coursePrice: tc.course_price ?? null,
    totalAmount: tc.total_amount ?? null,
    tableLabel: tc.table_label || null,
    occasion: tc.occasion || null,
    specialRequests: tc.special_requests || null,
    internalMemo: tc.memo || null,
    companions: tc.companions || null,
    cancelledAt: tc.cancelled_at ? new Date(tc.cancelled_at) : null,
    cancelReason: tc.cancel_reason || null,
    source: tc.source || null,
  };
}

/**
 * 単一予約をUpsert（冪等）
 */
export async function upsertReservation(tc: TCReservation): Promise<string> {
  // 内部IDに解決
  const shop = await prisma.shop.findUnique({ where: { tableCheckId: tc.shop_id } });
  if (!shop) {
    logger.warn(`Shop not found for tablecheck_id=${tc.shop_id}, skipping reservation ${tc.id}`);
    return "";
  }

  let customerInternalId: string | null = null;
  if (tc.customer_id) {
    const customer = await prisma.customer.findUnique({ where: { tableCheckId: tc.customer_id } });
    customerInternalId = customer?.id || null;
  }

  const data = mapReservationData(tc, shop.id, customerInternalId);

  const result = await prisma.reservation.upsert({
    where: { tableCheckId: tc.id },
    create: { tableCheckId: tc.id, ...data },
    update: data,
  });

  await prisma.syncLog.create({
    data: {
      objectType: "reservation",
      objectId: tc.id,
      action: "upsert",
      sourcePayload: JSON.stringify(tc),
    },
  });

  // 後処理: アラート生成
  try {
    await generateReservationAlerts(result.id);
  } catch (error) {
    logger.warn(`Alert generation failed for reservation ${result.id}`, {
      error: (error as Error).message,
    });
  }

  return result.id;
}

/**
 * 予約バックフィル（店舗ごとに全件取得→Upsert）
 */
export async function backfillReservations(): Promise<number> {
  logger.info("Starting reservation backfill");

  await prisma.syncState.upsert({
    where: { objectType: "reservation" },
    create: { objectType: "reservation", status: "running" },
    update: { status: "running", errorMessage: null },
  });

  try {
    const shops = await prisma.shop.findMany();
    let totalSynced = 0;

    for (const shop of shops) {
      let page = 1;
      let hasMore = true;

      while (hasMore) {
        const response = await tableCheckClient.listReservations(
          shop.tableCheckId,
          page,
          100
        );

        for (const tc of response.data) {
          const id = await upsertReservation(tc);
          if (id) totalSynced++;
        }

        logger.info(
          `Reservation backfill shop=${shop.name} page ${page}/${response.pagination.total_pages}`,
          { synced: totalSynced }
        );

        hasMore = page < response.pagination.total_pages;
        page++;
      }
    }

    await prisma.syncState.update({
      where: { objectType: "reservation" },
      data: {
        status: "idle",
        lastSyncAt: new Date(),
        recordsSynced: totalSynced,
      },
    });

    logger.info(`Reservation backfill complete: ${totalSynced} records`);
    return totalSynced;
  } catch (error) {
    await prisma.syncState.update({
      where: { objectType: "reservation" },
      data: {
        status: "error",
        errorMessage: (error as Error).message,
      },
    });
    throw error;
  }
}

/**
 * 増分同期：Sync通知で指定されたreservation_idを再取得してUpsert
 */
export async function syncReservationById(tableCheckReservationId: string): Promise<void> {
  logger.info(`Syncing reservation ${tableCheckReservationId}`);
  const tc = await tableCheckClient.getReservation(tableCheckReservationId);
  await upsertReservation(tc);
}
