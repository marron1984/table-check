import { prisma } from "../db";
import { logger } from "../logger";
import { tableCheckClient } from "../tablecheck";
import { config } from "../config";

/**
 * 店舗情報の同期（フランチャイズ→店舗）
 */
export async function syncShops(): Promise<number> {
  logger.info("Starting shop sync");

  // Franchise Upsert
  await prisma.franchise.upsert({
    where: { tableCheckId: config.tableCheck.franchiseId },
    create: {
      tableCheckId: config.tableCheck.franchiseId,
      name: "Default Franchise",
    },
    update: {},
  });

  const franchise = await prisma.franchise.findUnique({
    where: { tableCheckId: config.tableCheck.franchiseId },
  });

  if (!franchise) throw new Error("Franchise not found after upsert");

  const response = await tableCheckClient.listShops();
  let synced = 0;

  for (const tcShop of response.data) {
    await prisma.shop.upsert({
      where: { tableCheckId: tcShop.id },
      create: {
        tableCheckId: tcShop.id,
        franchiseId: franchise.id,
        name: tcShop.name,
        timezone: tcShop.timezone || "Asia/Tokyo",
        phone: tcShop.phone || null,
        address: tcShop.address || null,
      },
      update: {
        name: tcShop.name,
        timezone: tcShop.timezone || "Asia/Tokyo",
        phone: tcShop.phone || null,
        address: tcShop.address || null,
      },
    });
    synced++;
  }

  logger.info(`Shop sync complete: ${synced} shops`);
  return synced;
}
