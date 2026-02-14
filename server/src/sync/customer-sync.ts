import { prisma } from "../db";
import { logger } from "../logger";
import { tableCheckClient, type TCCustomer } from "../tablecheck";
import { normalizePhone, normalizeName, normalizeEmail, calcProfileCompleteness } from "../utils";
import { detectDuplicates } from "../services/customer-merge";
import { evaluateCustomerTags } from "../services/tagging";
import { recalculateScores } from "../services/scoring";

/**
 * TCCustomer → Prisma Upsert用データに変換
 */
function mapCustomerData(tc: TCCustomer) {
  const lastName = normalizeName(tc.last_name);
  const firstName = normalizeName(tc.first_name);
  const phone = tc.phone || null;
  const phoneNormalized = normalizePhone(tc.phone);
  const email = normalizeEmail(tc.email);

  const base = {
    lastName,
    firstName,
    lastNameKana: normalizeName(tc.last_name_kana),
    firstNameKana: normalizeName(tc.first_name_kana),
    lastNameEn: tc.last_name_en || null,
    firstNameEn: tc.first_name_en || null,
    email,
    phone,
    phoneNormalized,
    language: tc.language || "ja",
    country: tc.country || null,
    companyName: tc.company_name || null,
    companyRole: tc.company_role || null,
    allergies: tc.allergies || null,
    dietaryRestrictions: tc.dietary_restrictions || null,
    internalNote: tc.notes || null,
  };

  const profileCompleteness = calcProfileCompleteness({
    lastName,
    firstName,
    phone,
    email,
    lastNameKana: base.lastNameKana,
    allergies: base.allergies,
    language: base.language,
  });

  return { ...base, profileCompleteness };
}

/**
 * 単一顧客をUpsert（冪等）
 */
export async function upsertCustomer(tc: TCCustomer): Promise<string> {
  const data = mapCustomerData(tc);

  const result = await prisma.customer.upsert({
    where: { tableCheckId: tc.id },
    create: {
      tableCheckId: tc.id,
      ...data,
    },
    update: data,
  });

  // 同期ログ記録
  await prisma.syncLog.create({
    data: {
      objectType: "customer",
      objectId: tc.id,
      action: "upsert",
      sourcePayload: JSON.stringify(tc),
    },
  });

  // 後処理: タグ評価、スコア再計算、重複検出
  try {
    await evaluateCustomerTags(result.id);
    await recalculateScores(result.id);
    await detectDuplicates(result.id);
  } catch (error) {
    logger.warn(`Post-sync processing failed for customer ${result.id}`, {
      error: (error as Error).message,
    });
  }

  return result.id;
}

/**
 * 顧客バックフィル（全件取得→Upsert）
 */
export async function backfillCustomers(): Promise<number> {
  logger.info("Starting customer backfill");

  let page = 1;
  let totalSynced = 0;
  let hasMore = true;

  // sync state を記録
  await prisma.syncState.upsert({
    where: { objectType: "customer" },
    create: { objectType: "customer", status: "running" },
    update: { status: "running", errorMessage: null },
  });

  try {
    while (hasMore) {
      const response = await tableCheckClient.listCustomers(page, 100);

      for (const tc of response.data) {
        await upsertCustomer(tc);
        totalSynced++;
      }

      logger.info(`Customer backfill page ${page}/${response.pagination.total_pages}`, {
        synced: totalSynced,
      });

      hasMore = page < response.pagination.total_pages;
      page++;
    }

    await prisma.syncState.update({
      where: { objectType: "customer" },
      data: {
        status: "idle",
        lastSyncAt: new Date(),
        recordsSynced: totalSynced,
      },
    });

    logger.info(`Customer backfill complete: ${totalSynced} records`);
    return totalSynced;
  } catch (error) {
    await prisma.syncState.update({
      where: { objectType: "customer" },
      data: {
        status: "error",
        errorMessage: (error as Error).message,
      },
    });
    throw error;
  }
}

/**
 * 増分同期：Sync通知で指定されたcustomer_idを再取得してUpsert
 */
export async function syncCustomerById(tableCheckCustomerId: string): Promise<void> {
  logger.info(`Syncing customer ${tableCheckCustomerId}`);
  const tc = await tableCheckClient.getCustomer(tableCheckCustomerId);
  await upsertCustomer(tc);
}
