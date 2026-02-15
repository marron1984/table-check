import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding database...");

  // ============================================================
  // Admin user
  // ============================================================
  const adminEmail = process.env.ADMIN_EMAIL || "admin@dhpg.co.jp";
  const adminPassword = process.env.ADMIN_PASSWORD || "admin123";
  const hash = await bcrypt.hash(adminPassword, 10);

  await prisma.user.upsert({
    where: { email: adminEmail },
    update: {},
    create: {
      email: adminEmail,
      passwordHash: hash,
      displayName: "管理者",
      role: "admin",
    },
  });

  // Additional demo users
  const demoUsers = [
    { email: "manager@dhpg.co.jp", displayName: "予約マネージャー", role: "manager" },
    { email: "staff@dhpg.co.jp", displayName: "フロアスタッフ", role: "staff" },
    { email: "viewer@dhpg.co.jp", displayName: "閲覧ユーザー", role: "viewer" },
    { email: "analyst@dhpg.co.jp", displayName: "本部分析", role: "analyst" },
  ];

  for (const u of demoUsers) {
    await prisma.user.upsert({
      where: { email: u.email },
      update: {},
      create: {
        ...u,
        passwordHash: hash, // same password for dev
      },
    });
  }

  // ============================================================
  // Stores
  // ============================================================
  const stores = [
    { externalId: "shop_shikanoya_ginza", name: "鹿野屋 銀座", slug: "shikanoya-ginza" },
    { externalId: "shop_shikanoya_nishi", name: "鹿野屋 西麻布", slug: "shikanoya-nishi" },
    { externalId: "shop_shikanoya_kyoto", name: "鹿野屋 京都", slug: "shikanoya-kyoto" },
  ];

  for (const s of stores) {
    await prisma.store.upsert({
      where: { externalId: s.externalId },
      update: {},
      create: s,
    });
  }

  // ============================================================
  // Tags (20 tags)
  // ============================================================
  const tags = [
    { slug: "vip", label: "VIP", color: "#7c3aed", isAuto: true, autoRule: '{"visits_gte":10}', sortOrder: 1 },
    { slug: "svip", label: "SVIP", color: "#6d28d9", isAuto: false, sortOrder: 2 },
    { slug: "no-show-risk", label: "ノーショー注意", color: "#dc2626", isAuto: true, autoRule: '{"no_show_gte":2}', sortOrder: 3 },
    { slug: "severe-allergy", label: "重大アレルギー", color: "#ef4444", isAuto: false, sortOrder: 4 },
    { slug: "light-allergy", label: "軽アレルギー", color: "#f97316", isAuto: false, sortOrder: 5 },
    { slug: "anniversary", label: "記念日", color: "#ec4899", isAuto: false, sortOrder: 6 },
    { slug: "birthday", label: "誕生日", color: "#f472b6", isAuto: false, sortOrder: 7 },
    { slug: "regular", label: "常連", color: "#16a34a", isAuto: true, autoRule: '{"visits_gte":5}', sortOrder: 8 },
    { slug: "new-customer", label: "新規", color: "#0ea5e9", isAuto: true, autoRule: '{"visits_lte":1}', sortOrder: 9 },
    { slug: "cn-mainland", label: "中国大陸", color: "#64748b", isAuto: false, sortOrder: 10 },
    { slug: "tw", label: "台湾", color: "#64748b", isAuto: false, sortOrder: 11 },
    { slug: "hk-mo", label: "香港・マカオ", color: "#64748b", isAuto: false, sortOrder: 12 },
    { slug: "kr", label: "韓国", color: "#64748b", isAuto: false, sortOrder: 13 },
    { slug: "west", label: "欧米", color: "#64748b", isAuto: false, sortOrder: 14 },
    { slug: "quiet-seat", label: "静席希望", color: "#8b5cf6", isAuto: false, sortOrder: 15 },
    { slug: "photo-ng", label: "写真NG", color: "#f59e0b", isAuto: false, sortOrder: 16 },
    { slug: "sake-lover", label: "日本酒好き", color: "#22c55e", isAuto: false, sortOrder: 17 },
    { slug: "wine-lover", label: "ワイン好き", color: "#a855f7", isAuto: false, sortOrder: 18 },
    { slug: "corporate", label: "法人", color: "#3b82f6", isAuto: false, sortOrder: 19 },
    { slug: "press", label: "プレス・メディア", color: "#06b6d4", isAuto: false, sortOrder: 20 },
  ];

  for (const t of tags) {
    await prisma.tag.upsert({
      where: { slug: t.slug },
      update: {},
      create: t,
    });
  }

  // ============================================================
  // Demo customers
  // ============================================================
  const customersData = [
    { displayName: "田中 太郎", kanaName: "タナカ タロウ", phone: "090-1234-5678", email: "tanaka@example.com", phoneNormalized: "09012345678", emailNormalized: "tanaka@example.com", visitsCount: 15, allergySeverity: "none" as const, locale: "ja" },
    { displayName: "佐藤 花子", kanaName: "サトウ ハナコ", phone: "080-9876-5432", email: "sato.h@example.com", phoneNormalized: "08098765432", emailNormalized: "sato.h@example.com", visitsCount: 8, allergySeverity: "severe" as const, locale: "ja", preferences: JSON.stringify({ "アレルギー": "甲殻類・ナッツ", "席": "個室希望" }) },
    { displayName: "Wang Wei", kanaName: null, phone: "+86-138-1234-5678", email: "wang.wei@example.cn", phoneNormalized: "13812345678", emailNormalized: "wang.wei@example.cn", visitsCount: 3, allergySeverity: "none" as const, locale: "zh-CN", region: "CN_mainland" },
    { displayName: "Kim Soo-jin", kanaName: null, phone: "+82-10-1234-5678", email: "kim.sj@example.kr", phoneNormalized: "1012345678", emailNormalized: "kim.sj@example.kr", visitsCount: 5, allergySeverity: "light" as const, locale: "ko" },
    { displayName: "John Smith", kanaName: null, phone: "+1-555-0123", email: "john.smith@example.com", phoneNormalized: "5550123", emailNormalized: "john.smith@example.com", visitsCount: 2, allergySeverity: "none" as const, locale: "en", region: "WEST" },
    { displayName: "鈴木 一郎", kanaName: "スズキ イチロウ", phone: "090-5555-1234", email: null, phoneNormalized: "09055551234", emailNormalized: null, visitsCount: 22, allergySeverity: "none" as const, noShowCount: 0, locale: "ja" },
    { displayName: "高橋 美咲", kanaName: "タカハシ ミサキ", phone: "070-1111-2222", email: "takahashi@example.com", phoneNormalized: "07011112222", emailNormalized: "takahashi@example.com", visitsCount: 1, allergySeverity: "none" as const, noShowCount: 3, locale: "ja" },
  ];

  const storeRecord = await prisma.store.findFirst();
  const storeId = storeRecord?.id || "default";

  for (const c of customersData) {
    const existing = await prisma.customer.findFirst({ where: { phoneNormalized: c.phoneNormalized } });
    if (existing) continue;

    const customer = await prisma.customer.create({
      data: {
        displayName: c.displayName,
        kanaName: c.kanaName,
        phone: c.phone,
        phoneNormalized: c.phoneNormalized,
        email: c.email,
        emailNormalized: c.emailNormalized,
        visitsCount: c.visitsCount,
        allergySeverity: c.allergySeverity,
        locale: c.locale,
        region: (c as any).region || null,
        noShowCount: (c as any).noShowCount || 0,
        preferences: (c as any).preferences || "{}",
        lastVisitAt: new Date(Date.now() - Math.random() * 30 * 86400000),
        sources: {
          create: {
            externalId: `tc_customer_${c.phoneNormalized}`,
            rawPayload: JSON.stringify(c),
          },
        },
      },
    });

    // Auto-tag
    if (c.visitsCount >= 10) {
      const vipTag = await prisma.tag.findUnique({ where: { slug: "vip" } });
      if (vipTag) {
        await prisma.customerTag.create({
          data: { customerId: customer.id, tagId: vipTag.id, assignedBy: "system" },
        });
      }
    }
    if ((c as any).noShowCount >= 2) {
      const nsTag = await prisma.tag.findUnique({ where: { slug: "no-show-risk" } });
      if (nsTag) {
        await prisma.customerTag.create({
          data: { customerId: customer.id, tagId: nsTag.id, assignedBy: "system" },
        });
      }
    }
    if (c.allergySeverity === "severe") {
      const tag = await prisma.tag.findUnique({ where: { slug: "severe-allergy" } });
      if (tag) {
        await prisma.customerTag.create({
          data: { customerId: customer.id, tagId: tag.id, assignedBy: "system" },
        });
      }
    }

    // Demo reservations
    const statuses = ["completed", "confirmed", "seated"];
    for (let i = 0; i < Math.min(c.visitsCount, 5); i++) {
      const daysAgo = Math.floor(Math.random() * 365);
      const hour = 11 + Math.floor(Math.random() * 10);
      const date = new Date(Date.now() - daysAgo * 86400000);
      date.setHours(hour, 0, 0, 0);

      await prisma.reservation.create({
        data: {
          externalId: `tc_rsv_${customer.id}_${i}`,
          storeId,
          customerId: customer.id,
          startsAt: date,
          partySize: 1 + Math.floor(Math.random() * 4),
          status: daysAgo < 1 ? "confirmed" : statuses[Math.floor(Math.random() * statuses.length)],
          channel: ["web", "phone", "walk-in"][Math.floor(Math.random() * 3)],
          courseName: ["おまかせコース", "懐石コース", "鮨おまかせ", null][Math.floor(Math.random() * 4)] || undefined,
          flags: JSON.stringify({
            vip: c.visitsCount >= 10,
            severeAllergy: c.allergySeverity === "severe",
            noShowRisk: (c as any).noShowCount >= 2,
          }),
        },
      });
    }

    // Add today's reservation for some customers
    if (c.visitsCount > 5) {
      const todayDate = new Date();
      todayDate.setHours(18, 30, 0, 0);
      await prisma.reservation.create({
        data: {
          externalId: `tc_rsv_today_${customer.id}`,
          storeId,
          customerId: customer.id,
          startsAt: todayDate,
          partySize: 2 + Math.floor(Math.random() * 3),
          status: "confirmed",
          channel: "web",
          courseName: "おまかせコース",
          flags: JSON.stringify({
            vip: c.visitsCount >= 10,
            severeAllergy: c.allergySeverity === "severe",
            noShowRisk: (c as any).noShowCount >= 2,
          }),
        },
      });
    }
  }

  // ============================================================
  // Demo merge candidates
  // ============================================================
  const allCustomers = await prisma.customer.findMany({ take: 10 });
  if (allCustomers.length >= 2) {
    const existing = await prisma.mergeCandidate.findFirst();
    if (!existing) {
      await prisma.mergeCandidate.create({
        data: {
          customerAId: allCustomers[0].id,
          customerBId: allCustomers[1].id,
          score: 0.75,
          reasons: JSON.stringify(["name_similar:0.75"]),
          status: "pending",
        },
      });
    }
  }

  console.log("Seed completed.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
