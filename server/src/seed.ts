import { PrismaClient, ReservationStatus, AlertSeverity, StaffRole } from "@prisma/client";
import { randomUUID } from "crypto";

const prisma = new PrismaClient();

// ============================================================
// 高級レストラン向けダミーデータ（富裕層顧客100件）
// ============================================================

const LAST_NAMES = [
  "三井", "住友", "岩崎", "鳩山", "麻生", "安倍", "松下", "豊田", "柳井", "孫",
  "佐治", "森", "竹中", "中曽根", "細川", "近衛", "徳川", "伊藤", "渋沢", "岩井",
  "鬼塚", "白洲", "堤", "角川", "永守", "似鳥", "滝崎", "高田", "前澤", "三木谷",
  "藤田", "笠原", "田中", "村上", "青山", "黒田", "白石", "赤坂", "金子", "銀座",
  "西園寺", "東条", "南部", "北条", "中村", "大林", "小林", "山本", "上野", "下村",
];

const FIRST_NAMES_M = [
  "太郎", "一郎", "龍之介", "慎太郎", "雅彦", "正義", "英樹", "隆一", "浩二", "章男",
  "俊介", "健太郎", "誠", "剛", "翔", "圭", "拓也", "大輔", "直樹", "洋一",
  "光一", "秀明", "宗一郎", "幸之助", "栄一",
];

const FIRST_NAMES_F = [
  "美智子", "雅子", "紀子", "愛子", "佳子", "華子", "麗子", "由紀", "恵子", "真由美",
  "千鶴", "陽子", "沙織", "彩", "桜", "優花", "瑠璃子", "琴美", "凛", "結衣",
  "菜々子", "翠", "香織", "美咲", "泉",
];

const KANA_MAP: Record<string, string> = {
  "三井": "ミツイ", "住友": "スミトモ", "岩崎": "イワサキ", "鳩山": "ハトヤマ", "麻生": "アソウ",
  "安倍": "アベ", "松下": "マツシタ", "豊田": "トヨダ", "柳井": "ヤナイ", "孫": "ソン",
  "佐治": "サジ", "森": "モリ", "竹中": "タケナカ", "中曽根": "ナカソネ", "細川": "ホソカワ",
  "近衛": "コノエ", "徳川": "トクガワ", "伊藤": "イトウ", "渋沢": "シブサワ", "岩井": "イワイ",
  "鬼塚": "オニヅカ", "白洲": "シラス", "堤": "ツツミ", "角川": "カドカワ", "永守": "ナガモリ",
  "似鳥": "ニトリ", "滝崎": "タキザキ", "高田": "タカタ", "前澤": "マエザワ", "三木谷": "ミキタニ",
  "藤田": "フジタ", "笠原": "カサハラ", "田中": "タナカ", "村上": "ムラカミ", "青山": "アオヤマ",
  "黒田": "クロダ", "白石": "シライシ", "赤坂": "アカサカ", "金子": "カネコ", "銀座": "ギンザ",
  "西園寺": "サイオンジ", "東条": "トウジョウ", "南部": "ナンブ", "北条": "ホウジョウ",
  "中村": "ナカムラ", "大林": "オオバヤシ", "小林": "コバヤシ", "山本": "ヤマモト",
  "上野": "ウエノ", "下村": "シモムラ",
};

const FIRST_KANA_M: Record<string, string> = {
  "太郎": "タロウ", "一郎": "イチロウ", "龍之介": "リュウノスケ", "慎太郎": "シンタロウ",
  "雅彦": "マサヒコ", "正義": "マサヨシ", "英樹": "ヒデキ", "隆一": "リュウイチ",
  "浩二": "コウジ", "章男": "アキオ", "俊介": "シュンスケ", "健太郎": "ケンタロウ",
  "誠": "マコト", "剛": "ツヨシ", "翔": "ショウ", "圭": "ケイ", "拓也": "タクヤ",
  "大輔": "ダイスケ", "直樹": "ナオキ", "洋一": "ヨウイチ", "光一": "コウイチ",
  "秀明": "ヒデアキ", "宗一郎": "ソウイチロウ", "幸之助": "コウノスケ", "栄一": "エイイチ",
};

const FIRST_KANA_F: Record<string, string> = {
  "美智子": "ミチコ", "雅子": "マサコ", "紀子": "ノリコ", "愛子": "アイコ", "佳子": "カコ",
  "華子": "ハナコ", "麗子": "レイコ", "由紀": "ユキ", "恵子": "ケイコ", "真由美": "マユミ",
  "千鶴": "チヅル", "陽子": "ヨウコ", "沙織": "サオリ", "彩": "アヤ", "桜": "サクラ",
  "優花": "ユウカ", "瑠璃子": "ルリコ", "琴美": "コトミ", "凛": "リン", "結衣": "ユイ",
  "菜々子": "ナナコ", "翠": "ミドリ", "香織": "カオリ", "美咲": "ミサキ", "泉": "イズミ",
};

const COMPANIES = [
  "三菱商事", "三井物産", "住友商事", "伊藤忠商事", "丸紅",
  "ゴールドマン・サックス証券", "モルガン・スタンレーMUFG", "JPモルガン",
  "マッキンゼー", "ボストンコンサルティング", "ベインキャピタル",
  "ソフトバンクグループ", "トヨタ自動車", "ソニーグループ", "キーエンス",
  "野村ホールディングス", "三菱UFJ信託", "大和証券グループ",
  "東京海上日動", "三井不動産", "森ビル", "電通グループ",
];

const ROLES = [
  "代表取締役会長", "代表取締役社長", "取締役副社長", "専務取締役",
  "常務取締役", "執行役員", "マネージングディレクター", "パートナー",
  "シニアヴァイスプレジデント", "ファンドマネージャー",
];

const COURSES = [
  { name: "おまかせ特別コース", price: 55000 },
  { name: "季節の懐石 〜雅〜", price: 38000 },
  { name: "プレミアムディナー", price: 45000 },
  { name: "シェフズテーブル", price: 65000 },
  { name: "鮨おまかせ", price: 35000 },
  { name: "黒毛和牛コース", price: 42000 },
  { name: "フレンチ フルコース", price: 48000 },
  { name: "天ぷらおまかせ", price: 30000 },
  { name: "スペシャルペアリング付", price: 75000 },
  { name: "ランチおまかせ", price: 18000 },
];

const OCCASIONS = ["接待", "記念日", "デート", "会食", "慶事", "顔合わせ", "誕生日"];
const TABLES = ["個室 松", "個室 竹", "個室 梅", "VIPルーム A", "VIPルーム B", "カウンター特等", "テラス席"];
const HOTELS = ["リッツ・カールトン東京", "パークハイアット東京", "アマン東京", "マンダリンオリエンタル", "ペニンシュラ東京", "フォーシーズンズ丸の内"];
const SOURCES = ["tablecheck", "concierge", "phone"];

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function pickN<T>(arr: T[], n: number): T[] {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, n);
}

function randBetween(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function daysAgo(d: number): Date {
  const date = new Date();
  date.setDate(date.getDate() - d);
  return date;
}

function randomPhone(): string {
  const area = pick(["03", "06", "045", "052"]);
  const num = `${area}-${randBetween(1000, 9999)}-${randBetween(1000, 9999)}`;
  return num;
}

function normalizePhone(phone: string): string {
  return "+81" + phone.replace(/-/g, "").replace(/^0/, "");
}

async function main() {
  console.log("Seeding high-end customer data...");

  // 1. Franchise
  const franchise = await prisma.franchise.upsert({
    where: { tableCheckId: "franchise-001" },
    update: {},
    create: {
      tableCheckId: "franchise-001",
      name: "プレミアムダイニンググループ",
    },
  });

  // 2. Shops (3 stores)
  const shopData = [
    { tcId: "shop-ginza", name: "鮨 銀座 本店", phone: "03-1234-5678", address: "東京都中央区銀座6-10-1" },
    { tcId: "shop-roppongi", name: "フレンチ 六本木 ヒルズ", phone: "03-2345-6789", address: "東京都港区六本木6-10-1" },
    { tcId: "shop-aoyama", name: "懐石 青山", phone: "03-3456-7890", address: "東京都港区南青山5-1-1" },
  ];

  const shops = [];
  for (const s of shopData) {
    const shop = await prisma.shop.upsert({
      where: { tableCheckId: s.tcId },
      update: {},
      create: {
        tableCheckId: s.tcId,
        franchiseId: franchise.id,
        name: s.name,
        phone: s.phone,
        address: s.address,
      },
    });
    shops.push(shop);
  }

  // 3. Tag Definitions
  const tagDefs = [
    { slug: "vip", label: "VIP", labelJa: "VIP", category: "engagement", color: "#EF4444", priority: 100 },
    { slug: "vvip", label: "VVIP", labelJa: "VVIP", category: "engagement", color: "#DC2626", priority: 110 },
    { slug: "regular", label: "Regular", labelJa: "常連", category: "engagement", color: "#3B82F6", priority: 50 },
    { slug: "new-customer", label: "New", labelJa: "新規", category: "engagement", color: "#10B981", priority: 30 },
    { slug: "lapsed", label: "Lapsed", labelJa: "休眠", category: "engagement", color: "#6B7280", priority: 20 },
    { slug: "no-show-risk", label: "No-Show Risk", labelJa: "ノーショー注意", category: "risk", color: "#F59E0B", priority: 90 },
    { slug: "cancel-risk", label: "Cancel Risk", labelJa: "キャンセル注意", category: "risk", color: "#F97316", priority: 80 },
    { slug: "allergy-critical", label: "Allergy (Critical)", labelJa: "重大アレルギー", category: "preference", color: "#DC2626", priority: 100 },
    { slug: "allergy-mild", label: "Allergy (Mild)", labelJa: "アレルギー", category: "preference", color: "#FBBF24", priority: 60 },
    { slug: "wine-lover", label: "Wine", labelJa: "ワイン好き", category: "preference", color: "#7C3AED", priority: 30 },
    { slug: "sake-lover", label: "Sake", labelJa: "日本酒好き", category: "preference", color: "#7C3AED", priority: 30 },
    { slug: "vegetarian", label: "Vegetarian", labelJa: "ベジタリアン", category: "preference", color: "#10B981", priority: 40 },
    { slug: "corporate", label: "Corporate", labelJa: "法人", category: "attribute", color: "#1D4ED8", priority: 70 },
    { slug: "secretary", label: "Secretary", labelJa: "秘書", category: "attribute", color: "#6366F1", priority: 60 },
    { slug: "concierge", label: "Concierge", labelJa: "コンシェルジュ", category: "attribute", color: "#6366F1", priority: 60 },
    { slug: "anniversary", label: "Anniversary", labelJa: "記念日", category: "attribute", color: "#EC4899", priority: 50 },
    { slug: "inbound", label: "Inbound", labelJa: "インバウンド", category: "attribute", color: "#F59E0B", priority: 40 },
    { slug: "high-spender", label: "High Spender", labelJa: "高単価", category: "engagement", color: "#A855F7", priority: 85 },
    { slug: "influencer", label: "Influencer", labelJa: "インフルエンサー", category: "attribute", color: "#EC4899", priority: 45 },
    { slug: "birthday-month", label: "Birthday Month", labelJa: "誕生月", category: "attribute", color: "#F472B6", priority: 35 },
  ];

  const tagMap: Record<string, string> = {};
  for (const t of tagDefs) {
    const tag = await prisma.tagDefinition.upsert({
      where: { slug: t.slug },
      update: {},
      create: t,
    });
    tagMap[t.slug] = tag.id;
  }

  // 4. Staff
  const staff = await prisma.staff.upsert({
    where: { email: "admin@example.com" },
    update: {},
    create: {
      id: "demo-staff",
      email: "admin@example.com",
      name: "管理者",
      role: StaffRole.ADMIN,
      passwordHash: "dummy-hash",
      shopIds: JSON.stringify(shops.map((s) => s.id)),
    },
  });

  // 5. Generate 100 Customers
  console.log("Creating 100 high-end customers...");
  const customers = [];

  for (let i = 0; i < 100; i++) {
    const isFemale = Math.random() < 0.35;
    const lastName = LAST_NAMES[i % LAST_NAMES.length];
    const firstName = isFemale
      ? FIRST_NAMES_F[i % FIRST_NAMES_F.length]
      : FIRST_NAMES_M[i % FIRST_NAMES_M.length];

    const lastNameKana = KANA_MAP[lastName] || "カナ";
    const firstNameKana = isFemale
      ? (FIRST_KANA_F[firstName] || "カナ")
      : (FIRST_KANA_M[firstName] || "カナ");

    const phone = randomPhone();
    const hasCompany = Math.random() < 0.65;
    const hasAllergy = Math.random() < 0.25;
    const hasSecretary = hasCompany && Math.random() < 0.4;
    const hasConcierge = Math.random() < 0.2;

    const visitCount = randBetween(3, 40);
    const avgSpend = randBetween(25000, 80000);
    const ltv = avgSpend * visitCount * 0.8;
    const lastVisitDays = randBetween(1, 120);

    const allergies = hasAllergy
      ? JSON.stringify(pickN([
          { name: "甲殻類", severity: "critical" },
          { name: "そば", severity: "critical" },
          { name: "ナッツ", severity: "high" },
          { name: "小麦", severity: "mild" },
          { name: "乳製品", severity: "mild" },
          { name: "卵", severity: "mild" },
        ], randBetween(1, 2)))
      : null;

    const preferences = Math.random() < 0.6
      ? JSON.stringify({
          "好みのワイン": pick(["ブルゴーニュ赤", "ボルドー", "シャンパーニュ", "バローロ", "日本酒（純米大吟醸）"]),
          "席の好み": pick(["個室希望", "カウンター希望", "窓際希望", "奥の席希望"]),
          ...(Math.random() < 0.3 ? { "温度": pick(["室温やや低め", "暖かめ希望"]) } : {}),
        })
      : null;

    const customer = await prisma.customer.create({
      data: {
        tableCheckId: `tc-customer-${String(i + 1).padStart(4, "0")}`,
        lastName,
        firstName,
        lastNameKana,
        firstNameKana,
        lastNameEn: lastNameKana.toLowerCase().replace(/ウ$/, "u"),
        firstNameEn: firstNameKana.toLowerCase().replace(/ウ$/, "u"),
        email: `${lastNameKana.toLowerCase()}${i + 1}@${pick(["gmail.com", "icloud.com", "company.co.jp"])}`,
        phone,
        phoneNormalized: normalizePhone(phone),
        language: Math.random() < 0.9 ? "ja" : pick(["en", "zh", "ko"]),
        allergies,
        dietaryRestrictions: Math.random() < 0.1 ? pick(["グルテンフリー", "ペスカタリアン", "ハラール"]) : null,
        preferences,
        internalNote: Math.random() < 0.4
          ? pick([
            "写真撮影NG（プライバシー重視）",
            "接待利用が多い。同伴者のアレルギーも要確認",
            "ワインに詳しい。ソムリエと直接話したがる",
            "毎回花束を用意する。夫人の好みはカサブランカ",
            "お子様連れの場合あり。個室を優先的に案内",
            "グループ会長。秘書経由の予約が基本",
            "海外出張が多く、帰国時にまとめて予約する傾向",
            "誕生月（12月）はサプライズケーキを用意",
          ])
          : null,
        companyName: hasCompany ? pick(COMPANIES) : null,
        companyRole: hasCompany ? pick(ROLES) : null,
        secretaryName: hasSecretary ? `${pick(LAST_NAMES)}${pick(["美香", "由美", "真理", "智子"])}` : null,
        secretaryPhone: hasSecretary ? randomPhone() : null,
        secretaryEmail: hasSecretary ? `secretary${i}@company.co.jp` : null,
        conciergeName: hasConcierge ? `${pick(HOTELS)} コンシェルジュ` : null,
        conciergeSource: hasConcierge ? pick(HOTELS) : null,
        referrerName: Math.random() < 0.15 ? `${pick(LAST_NAMES)}様のご紹介` : null,
        ltvScore: ltv,
        returnProbability90: Math.min(0.95, 0.3 + Math.random() * 0.65),
        returnProbability180: Math.min(0.98, 0.5 + Math.random() * 0.48),
        cancelRisk: Math.random() * 0.15,
        profileCompleteness: 0.6 + Math.random() * 0.4,
        lastVisitAt: daysAgo(lastVisitDays),
      },
    });
    customers.push(customer);

    // Tags
    const tagSlugs: string[] = [];
    if (ltv > 800000) tagSlugs.push("vvip");
    else if (ltv > 400000) tagSlugs.push("vip");
    if (visitCount >= 10) tagSlugs.push("regular");
    if (visitCount <= 2) tagSlugs.push("new-customer");
    if (lastVisitDays > 90) tagSlugs.push("lapsed");
    if (hasCompany) tagSlugs.push("corporate");
    if (hasSecretary) tagSlugs.push("secretary");
    if (hasConcierge) tagSlugs.push("concierge");
    if (hasAllergy && allergies?.includes("critical")) tagSlugs.push("allergy-critical");
    else if (hasAllergy) tagSlugs.push("allergy-mild");
    if (preferences?.includes("ワイン") || preferences?.includes("ブルゴーニュ") || preferences?.includes("ボルドー")) tagSlugs.push("wine-lover");
    if (preferences?.includes("日本酒")) tagSlugs.push("sake-lover");
    if (avgSpend >= 50000) tagSlugs.push("high-spender");
    if (Math.random() < 0.1) tagSlugs.push("anniversary");

    for (const slug of tagSlugs) {
      if (tagMap[slug]) {
        await prisma.customerTag.create({
          data: {
            customerId: customer.id,
            tagDefinitionId: tagMap[slug],
            assignedBy: "auto",
          },
        });
      }
    }

    // Membership
    if (ltv > 600000) {
      await prisma.membership.create({
        data: {
          customerId: customer.id,
          tier: ltv > 1200000 ? "platinum" : ltv > 800000 ? "gold" : "silver",
          status: "active",
          startDate: daysAgo(randBetween(180, 720)),
        },
      });
    }
  }

  // 6. Reservations (past + today + future)
  console.log("Creating reservations...");

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (let ci = 0; ci < customers.length; ci++) {
    const customer = customers[ci];
    const numReservations = randBetween(2, 15);

    for (let j = 0; j < numReservations; j++) {
      const shop = pick(shops);
      const course = pick(COURSES);
      // First 25 customers always get today reservation on j=0
      const isToday = j === 0 && (ci < 25 || Math.random() < 0.15);
      const isFuture = !isToday && j === 0 && Math.random() < 0.15;
      const daysOffset = isToday ? 0 : isFuture ? -(randBetween(1, 14)) : randBetween(1, 500);

      const dateTime = new Date(today);
      dateTime.setDate(dateTime.getDate() - daysOffset);
      dateTime.setHours(pick([11, 12, 17, 18, 19, 20]), pick([0, 30]), 0, 0);

      const isPast = dateTime < new Date();
      const partySize = randBetween(2, 8);
      const totalAmount = course.price * partySize + randBetween(0, 30000);

      let status: ReservationStatus;
      if (isToday) {
        // Today's reservations are always CONFIRMED (upcoming)
        status = ReservationStatus.CONFIRMED;
      } else if (!isPast) {
        status = ReservationStatus.CONFIRMED;
      } else if (Math.random() < 0.03) {
        status = ReservationStatus.NO_SHOW;
      } else if (Math.random() < 0.05) {
        status = ReservationStatus.CANCELLED;
      } else {
        status = ReservationStatus.COMPLETED;
      }

      const reservation = await prisma.reservation.create({
        data: {
          tableCheckId: `tc-rsv-${customer.id.slice(0, 8)}-${j}`,
          shopId: shop.id,
          customerId: customer.id,
          dateTime,
          partySize,
          status,
          courseName: course.name,
          coursePrice: course.price,
          totalAmount,
          tableLabel: Math.random() < 0.6 ? pick(TABLES) : null,
          occasion: Math.random() < 0.5 ? pick(OCCASIONS) : null,
          specialRequests: Math.random() < 0.3
            ? pick([
              "窓際の個室を希望",
              "バースデーケーキをご用意ください（名前: 美智子）",
              "アレルギー情報は顧客プロフィールを参照",
              "ワインペアリングを事前にソムリエと相談したい",
              "お花をテーブルに飾ってほしい（予算1万円）",
              "同行者に外国人あり。英語メニュー希望",
            ])
            : null,
          internalMemo: Math.random() < 0.2
            ? pick([
              "前回の来店で料理長が挨拶済み",
              "社長就任祝いのご利用",
              "雑誌の取材を兼ねた会食",
            ])
            : null,
          source: pick(SOURCES),
          cancelledAt: status === ReservationStatus.CANCELLED ? dateTime : null,
          cancelReason: status === ReservationStatus.CANCELLED ? pick(["体調不良", "スケジュール変更", "天候"]) : null,
        },
      });

      // Alerts for today's reservations
      if (isToday && status === ReservationStatus.CONFIRMED) {
        // VIP alert
        const customerLtv = customer.ltvScore ?? 0;
        if (customerLtv > 400000) {
          await prisma.reservationAlert.create({
            data: {
              reservationId: reservation.id,
              severity: customerLtv > 800000 ? AlertSeverity.HIGH : AlertSeverity.MEDIUM,
              alertType: "vip",
              message: customerLtv > 800000
                ? `VVIPのお客様です（LTV: ${Math.round(customerLtv).toLocaleString()}円）。料理長への事前連絡をお願いします。`
                : `VIPのお客様です（LTV: ${Math.round(customerLtv).toLocaleString()}円）`,
            },
          });
        }

        // Allergy alert
        if (customer.allergies) {
          const parsed = JSON.parse(customer.allergies);
          const hasCritical = parsed.some((a: { severity?: string }) => a.severity === "critical");
          await prisma.reservationAlert.create({
            data: {
              reservationId: reservation.id,
              severity: hasCritical ? AlertSeverity.CRITICAL : AlertSeverity.MEDIUM,
              alertType: "allergy",
              message: `アレルギー: ${parsed.map((a: { name: string }) => a.name).join(", ")}`,
            },
          });
        }

        // Anniversary/occasion alert
        if (reservation.occasion && ["記念日", "誕生日"].includes(reservation.occasion)) {
          await prisma.reservationAlert.create({
            data: {
              reservationId: reservation.id,
              severity: AlertSeverity.MEDIUM,
              alertType: "anniversary",
              message: `${reservation.occasion}のご利用です。サプライズ演出の確認をお願いします。`,
            },
          });
        }
      }
    }
  }

  // 7. Duplicate candidates (a few)
  console.log("Creating duplicate candidates...");
  for (let k = 0; k < 5; k++) {
    const c1 = customers[k * 2];
    const c2 = customers[k * 2 + 1];
    await prisma.duplicateCandidate.create({
      data: {
        primaryId: c1.id,
        secondaryId: c2.id,
        confidenceScore: 0.35 + Math.random() * 0.35,
        matchReasons: JSON.stringify(pick([["phone"], ["email", "name"], ["name_kana"], ["phone", "name"]])),
      },
    });
  }

  // 8. Sync state
  for (const entityType of ["customer", "reservation", "shop"]) {
    await prisma.syncState.upsert({
      where: { objectType: entityType },
      update: { lastSyncAt: new Date(), status: "idle", recordsSynced: entityType === "customer" ? 100 : entityType === "reservation" ? 800 : 3 },
      create: {
        objectType: entityType,
        lastSyncAt: new Date(),
        status: "idle",
        recordsSynced: entityType === "customer" ? 100 : entityType === "reservation" ? 800 : 3,
      },
    });
  }

  const counts = await Promise.all([
    prisma.customer.count(),
    prisma.reservation.count(),
    prisma.customerTag.count(),
    prisma.reservationAlert.count(),
    prisma.membership.count(),
    prisma.duplicateCandidate.count(),
  ]);

  console.log("\n=== Seed Complete ===");
  console.log(`  Customers:    ${counts[0]}`);
  console.log(`  Reservations: ${counts[1]}`);
  console.log(`  Tags:         ${counts[2]}`);
  console.log(`  Alerts:       ${counts[3]}`);
  console.log(`  Memberships:  ${counts[4]}`);
  console.log(`  Duplicates:   ${counts[5]}`);
  console.log(`  Shops:        ${shops.length}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
