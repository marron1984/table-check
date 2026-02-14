import { prisma } from "../db";
import { logger } from "../logger";

/**
 * 初期タグ定義（20個）
 */
const DEFAULT_TAGS = [
  // Engagement
  { slug: "vip", label: "VIP", labelJa: "VIP", category: "engagement", color: "#EF4444", priority: 100 },
  { slug: "vvip", label: "VVIP", labelJa: "VVIP", category: "engagement", color: "#DC2626", priority: 110 },
  { slug: "regular", label: "Regular", labelJa: "常連", category: "engagement", color: "#3B82F6", priority: 50 },
  { slug: "new-customer", label: "New", labelJa: "新規", category: "engagement", color: "#10B981", priority: 30 },
  { slug: "lapsed", label: "Lapsed", labelJa: "休眠", category: "engagement", color: "#6B7280", priority: 20 },

  // Risk
  { slug: "no-show-risk", label: "No-Show Risk", labelJa: "ノーショー注意", category: "risk", color: "#F59E0B", priority: 90 },
  { slug: "cancel-risk", label: "Cancel Risk", labelJa: "キャンセル注意", category: "risk", color: "#F97316", priority: 80 },

  // Preference
  { slug: "allergy-critical", label: "Allergy (Critical)", labelJa: "重大アレルギー", category: "preference", color: "#DC2626", priority: 100 },
  { slug: "allergy-mild", label: "Allergy (Mild)", labelJa: "アレルギー", category: "preference", color: "#FBBF24", priority: 60 },
  { slug: "wine-lover", label: "Wine", labelJa: "ワイン好き", category: "preference", color: "#7C3AED", priority: 30 },
  { slug: "sake-lover", label: "Sake", labelJa: "日本酒好き", category: "preference", color: "#7C3AED", priority: 30 },
  { slug: "vegetarian", label: "Vegetarian", labelJa: "ベジタリアン", category: "preference", color: "#10B981", priority: 40 },

  // Attribute
  { slug: "corporate", label: "Corporate", labelJa: "法人", category: "attribute", color: "#1D4ED8", priority: 70 },
  { slug: "secretary", label: "Secretary", labelJa: "秘書", category: "attribute", color: "#6366F1", priority: 60 },
  { slug: "concierge", label: "Concierge", labelJa: "コンシェルジュ", category: "attribute", color: "#6366F1", priority: 60 },
  { slug: "anniversary", label: "Anniversary", labelJa: "記念日", category: "attribute", color: "#EC4899", priority: 50 },
  { slug: "inbound-en", label: "Inbound (EN)", labelJa: "インバウンド(英語)", category: "attribute", color: "#0EA5E9", priority: 40 },
  { slug: "inbound-zh", label: "Inbound (ZH)", labelJa: "インバウンド(中国語)", category: "attribute", color: "#0EA5E9", priority: 40 },
  { slug: "inbound-ko", label: "Inbound (KO)", labelJa: "インバウンド(韓国語)", category: "attribute", color: "#0EA5E9", priority: 40 },
  { slug: "inbound-other", label: "Inbound (Other)", labelJa: "インバウンド(その他)", category: "attribute", color: "#0EA5E9", priority: 40 },
];

/**
 * デフォルトタグ定義を初期化
 */
export async function seedTagDefinitions(): Promise<void> {
  for (const tag of DEFAULT_TAGS) {
    await prisma.tagDefinition.upsert({
      where: { slug: tag.slug },
      create: tag,
      update: { label: tag.label, labelJa: tag.labelJa, color: tag.color, priority: tag.priority },
    });
  }
  logger.info(`Seeded ${DEFAULT_TAGS.length} tag definitions`);
}

/**
 * 顧客のタグを自動評価・付与する
 */
export async function evaluateCustomerTags(customerId: string): Promise<void> {
  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
    include: {
      reservations: {
        where: { status: { not: "CANCELLED" } },
        orderBy: { dateTime: "desc" },
      },
      tags: { include: { tagDefinition: true } },
    },
  });

  if (!customer || customer.mergedIntoId) return;

  const now = new Date();
  const tagsToAssign: string[] = [];

  // --- VIP判定: 直近12か月の来店数 or 総額 ---
  const twelveMonthsAgo = new Date(now);
  twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);
  const recentReservations = customer.reservations.filter(
    (r) => r.dateTime >= twelveMonthsAgo && (r.status === "COMPLETED" || r.status === "SEATED")
  );
  const totalSpend = recentReservations.reduce((sum, r) => sum + (r.totalAmount || 0), 0);
  const visitCount = recentReservations.length;

  if (visitCount >= 12 || totalSpend >= 500000) {
    tagsToAssign.push("vvip");
    tagsToAssign.push("vip");
  } else if (visitCount >= 6 || totalSpend >= 200000) {
    tagsToAssign.push("vip");
  }

  // --- 常連判定: 直近6か月に3回以上 ---
  const sixMonthsAgo = new Date(now);
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
  const recentSixMonths = customer.reservations.filter(
    (r) => r.dateTime >= sixMonthsAgo && (r.status === "COMPLETED" || r.status === "SEATED")
  );
  if (recentSixMonths.length >= 3) {
    tagsToAssign.push("regular");
  }

  // --- 新規: 来店1回 ---
  const completedAll = customer.reservations.filter(
    (r) => r.status === "COMPLETED" || r.status === "SEATED"
  );
  if (completedAll.length <= 1) {
    tagsToAssign.push("new-customer");
  }

  // --- 休眠: 最終来店から180日以上 ---
  if (customer.lastVisitAt) {
    const daysSinceVisit = Math.floor(
      (now.getTime() - customer.lastVisitAt.getTime()) / (1000 * 60 * 60 * 24)
    );
    if (daysSinceVisit > 180 && completedAll.length > 0) {
      tagsToAssign.push("lapsed");
    }
  }

  // --- ノーショー注意 ---
  const noShows = customer.reservations.filter((r) => r.status === "NO_SHOW");
  if (noShows.length >= 2) {
    tagsToAssign.push("no-show-risk");
  }

  // --- キャンセル注意: 直近10件の30%以上がキャンセル ---
  const recentTen = customer.reservations.slice(0, 10);
  const cancels = recentTen.filter((r) => r.status === "CANCELLED");
  if (recentTen.length >= 3 && cancels.length / recentTen.length >= 0.3) {
    tagsToAssign.push("cancel-risk");
  }

  // --- アレルギー ---
  if (customer.allergies) {
    try {
      const allergies = JSON.parse(customer.allergies);
      const hasCritical = allergies.some(
        (a: { severity?: string }) => a.severity === "critical" || a.severity === "high"
      );
      tagsToAssign.push(hasCritical ? "allergy-critical" : "allergy-mild");
    } catch {
      tagsToAssign.push("allergy-mild");
    }
  }

  // --- 法人 ---
  if (customer.companyName) {
    tagsToAssign.push("corporate");
  }

  // --- 秘書 ---
  if (customer.secretaryName) {
    tagsToAssign.push("secretary");
  }

  // --- コンシェルジュ ---
  if (customer.conciergeName) {
    tagsToAssign.push("concierge");
  }

  // --- 記念日: 予約に「記念日」が含まれる ---
  const hasAnniversary = customer.reservations.some(
    (r) => r.occasion && /記念日|anniversary|birthday|誕生日/i.test(r.occasion)
  );
  if (hasAnniversary) {
    tagsToAssign.push("anniversary");
  }

  // --- インバウンド ---
  if (customer.language && customer.language !== "ja") {
    const langMap: Record<string, string> = {
      en: "inbound-en",
      zh: "inbound-zh",
      ko: "inbound-ko",
    };
    tagsToAssign.push(langMap[customer.language] || "inbound-other");
  }

  // タグをDB反映
  const tagDefs = await prisma.tagDefinition.findMany({
    where: { slug: { in: tagsToAssign } },
  });

  for (const tagDef of tagDefs) {
    await prisma.customerTag.upsert({
      where: {
        customerId_tagDefinitionId: {
          customerId: customer.id,
          tagDefinitionId: tagDef.id,
        },
      },
      create: {
        customerId: customer.id,
        tagDefinitionId: tagDef.id,
        assignedBy: "auto",
        metadata: JSON.stringify({ evaluatedAt: now.toISOString() }),
      },
      update: {
        assignedBy: "auto",
        metadata: JSON.stringify({ evaluatedAt: now.toISOString() }),
      },
    });
  }

  // 該当しなくなったautoタグを削除
  const currentAutoTags = customer.tags.filter((t) => t.assignedBy === "auto");
  for (const existing of currentAutoTags) {
    if (!tagsToAssign.includes(existing.tagDefinition.slug)) {
      await prisma.customerTag.delete({ where: { id: existing.id } });
    }
  }
}
