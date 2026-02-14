/**
 * デモ用静的データ
 * 本番ではサーバーAPIを使用。デモ/Vercel展開時はこのデータを使用。
 */
import type {
  Customer, CustomerDetail, Reservation, ReservationDetail,
  TagDefinition, CustomerTag, Alert, Membership,
  DuplicateCandidate, DashboardStats, SyncState, Pagination,
} from "../api";

// ============================================================
// Deterministic pseudo-random (seed-based for consistency)
// ============================================================
let _seed = 42;
function rand(): number {
  _seed = (_seed * 16807 + 0) % 2147483647;
  return (_seed - 1) / 2147483646;
}
function pick<T>(arr: T[]): T { return arr[Math.floor(rand() * arr.length)]; }
function pickN<T>(arr: T[], n: number): T[] {
  const s = [...arr].sort(() => rand() - 0.5);
  return s.slice(0, n);
}
function randBetween(min: number, max: number): number {
  return Math.floor(rand() * (max - min + 1)) + min;
}
function uuid(i: number): string {
  const h = i.toString(16).padStart(8, "0");
  return `${h}-0000-4000-8000-${h.padStart(12, "0")}`;
}

// ============================================================
// Constants
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
const SOURCES = ["tablecheck", "concierge", "phone"];

// ============================================================
// Shops
// ============================================================
export const shops = [
  { id: uuid(9001), name: "鮨 銀座 本店" },
  { id: uuid(9002), name: "フレンチ 六本木 ヒルズ" },
  { id: uuid(9003), name: "懐石 青山" },
];

// ============================================================
// Tag Definitions
// ============================================================
const tagDefData = [
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

// tagCounts will be populated after customers are generated
const tagCounts: Record<string, number> = {};
export const tagDefinitions: TagDefinition[] = tagDefData.map((t, i) => {
  tagCounts[t.slug] = 0;
  return {
    id: uuid(8000 + i),
    slug: t.slug,
    label: t.label,
    labelJa: t.labelJa,
    category: t.category,
    color: t.color,
    priority: t.priority,
    _count: { customerTags: 0 }, // will be updated
  };
});

const tagBySlug = (slug: string) => tagDefinitions.find((t) => t.slug === slug)!;

// ============================================================
// Generate Customers
// ============================================================
function generateCustomers(): CustomerDetail[] {
  _seed = 42; // reset for determinism
  const result: CustomerDetail[] = [];

  for (let i = 0; i < 100; i++) {
    const isFemale = rand() < 0.35;
    const lastName = LAST_NAMES[i % LAST_NAMES.length];
    const firstName = isFemale
      ? FIRST_NAMES_F[i % FIRST_NAMES_F.length]
      : FIRST_NAMES_M[i % FIRST_NAMES_M.length];

    const lastNameKana = KANA_MAP[lastName] || "カナ";
    const firstNameKana = isFemale
      ? (FIRST_KANA_F[firstName] || "カナ")
      : (FIRST_KANA_M[firstName] || "カナ");

    const phone = `${pick(["03", "06", "045", "052"])}-${randBetween(1000, 9999)}-${randBetween(1000, 9999)}`;
    const hasCompany = rand() < 0.65;
    const hasAllergy = rand() < 0.25;
    const hasSecretary = hasCompany && rand() < 0.4;
    const hasConcierge = rand() < 0.2;

    const visitCount = randBetween(3, 40);
    const avgSpend = randBetween(25000, 80000);
    const ltv = avgSpend * visitCount * 0.8;
    const lastVisitDays = randBetween(1, 120);

    const allergiesRaw = hasAllergy
      ? pickN([
          { name: "甲殻類", severity: "critical" },
          { name: "そば", severity: "critical" },
          { name: "ナッツ", severity: "high" },
          { name: "小麦", severity: "mild" },
          { name: "乳製品", severity: "mild" },
          { name: "卵", severity: "mild" },
        ], randBetween(1, 2))
      : null;

    const preferencesRaw = rand() < 0.6
      ? {
          "好みのワイン": pick(["ブルゴーニュ赤", "ボルドー", "シャンパーニュ", "バローロ", "日本酒（純米大吟醸）"]),
          "席の好み": pick(["個室希望", "カウンター希望", "窓際希望", "奥の席希望"]),
          ...(rand() < 0.3 ? { "温度": pick(["室温やや低め", "暖かめ希望"]) } : {}),
        }
      : null;

    const allergies = allergiesRaw ? JSON.stringify(allergiesRaw) : null;
    const preferences = preferencesRaw ? JSON.stringify(preferencesRaw) : null;

    const HOTELS = ["リッツ・カールトン東京", "パークハイアット東京", "アマン東京", "マンダリンオリエンタル", "ペニンシュラ東京"];

    // Build tags
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
    if (rand() < 0.1) tagSlugs.push("anniversary");

    const tags: CustomerTag[] = tagSlugs.map((slug, ti) => {
      tagCounts[slug] = (tagCounts[slug] || 0) + 1;
      const td = tagBySlug(slug);
      return {
        id: uuid(10000 + i * 20 + ti),
        assignedBy: "auto",
        tagDefinition: td,
      };
    });

    // Membership
    const memberships: Membership[] = [];
    if (ltv > 600000) {
      memberships.push({
        id: uuid(20000 + i),
        tier: ltv > 1200000 ? "platinum" : ltv > 800000 ? "gold" : "silver",
        status: "active",
        startDate: new Date(Date.now() - randBetween(180, 720) * 86400000).toISOString(),
        endDate: null,
      });
    }

    const lastVisitAt = new Date(Date.now() - lastVisitDays * 86400000).toISOString();
    const emailDomain = pick(["gmail.com", "icloud.com", "company.co.jp"]);

    const customer: CustomerDetail = {
      id: uuid(1000 + i),
      lastName,
      firstName,
      lastNameKana,
      firstNameKana,
      phone,
      email: `${lastNameKana.toLowerCase()}${i + 1}@${emailDomain}`,
      language: rand() < 0.9 ? "ja" : pick(["en", "zh", "ko"]),
      companyName: hasCompany ? pick(COMPANIES) : null,
      companyRole: hasCompany ? pick(ROLES) : null,
      allergies,
      dietaryRestrictions: rand() < 0.1 ? pick(["グルテンフリー", "ペスカタリアン", "ハラール"]) : null,
      preferences,
      internalNote: rand() < 0.4
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
      secretaryName: hasSecretary ? `${pick(LAST_NAMES)}${pick(["美香", "由美", "真理", "智子"])}` : null,
      secretaryPhone: hasSecretary ? `03-${randBetween(1000, 9999)}-${randBetween(1000, 9999)}` : null,
      secretaryEmail: hasSecretary ? `secretary${i}@company.co.jp` : null,
      referrerName: rand() < 0.15 ? `${pick(LAST_NAMES)}様のご紹介` : null,
      conciergeName: hasConcierge ? `${pick(HOTELS)} コンシェルジュ` : null,
      conciergeSource: hasConcierge ? pick(HOTELS) : null,
      ltvScore: Math.round(ltv),
      returnProbability90: Math.round((0.3 + rand() * 0.65) * 100) / 100,
      returnProbability180: Math.round((0.5 + rand() * 0.48) * 100) / 100,
      cancelRisk: Math.round(rand() * 0.15 * 100) / 100,
      profileCompleteness: Math.round((0.6 + rand() * 0.4) * 100) / 100,
      lastVisitAt,
      tags,
      reservations: [], // will be populated
      memberships,
      mergedFrom: [],
      _count: { reservations: 0 }, // will be updated
    };

    result.push(customer);
  }

  return result;
}

export const allCustomers = generateCustomers();

// Update tag counts
for (const td of tagDefinitions) {
  td._count = { customerTags: tagCounts[td.slug] || 0 };
}

// ============================================================
// Generate Reservations
// ============================================================
function generateReservations(): { all: ReservationDetail[]; today: ReservationDetail[] } {
  const all: ReservationDetail[] = [];
  const today: ReservationDetail[] = [];
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  let rsvIdx = 0;

  for (let ci = 0; ci < allCustomers.length; ci++) {
    const customer = allCustomers[ci];
    const numReservations = randBetween(2, 15);
    const customerReservations: Reservation[] = [];

    for (let j = 0; j < numReservations; j++) {
      const shop = pick(shops);
      const course = pick(COURSES);

      // First 25 customers always get today reservation on j=0
      const isToday = j === 0 && (ci < 25 || rand() < 0.15);
      const isFuture = !isToday && j === 0 && rand() < 0.15;
      const daysOffset = isToday ? 0 : isFuture ? -(randBetween(1, 14)) : randBetween(1, 500);

      const dateTime = new Date(todayStart);
      dateTime.setDate(dateTime.getDate() - daysOffset);
      const hour = pick([11, 12, 17, 18, 19, 20]);
      const minute = pick([0, 30]);
      dateTime.setHours(hour, minute, 0, 0);

      const isPast = dateTime < now;
      const partySize = randBetween(2, 8);

      let status: string;
      if (isToday) {
        status = "CONFIRMED";
      } else if (!isPast) {
        status = "CONFIRMED";
      } else if (rand() < 0.03) {
        status = "NO_SHOW";
      } else if (rand() < 0.05) {
        status = "CANCELLED";
      } else {
        status = "COMPLETED";
      }

      // Build alerts for today's confirmed reservations
      const alerts: Alert[] = [];
      if (isToday && status === "CONFIRMED") {
        const customerLtv = customer.ltvScore ?? 0;
        if (customerLtv > 400000) {
          alerts.push({
            id: uuid(50000 + rsvIdx * 10),
            severity: customerLtv > 800000 ? "HIGH" : "MEDIUM",
            alertType: "vip",
            message: customerLtv > 800000
              ? `VVIPのお客様です（LTV: ${customerLtv.toLocaleString()}円）。料理長への事前連絡をお願いします。`
              : `VIPのお客様です（LTV: ${customerLtv.toLocaleString()}円）`,
          });
        }

        if (customer.allergies) {
          try {
            const parsed = JSON.parse(customer.allergies);
            const hasCritical = parsed.some((a: { severity?: string }) => a.severity === "critical");
            alerts.push({
              id: uuid(50000 + rsvIdx * 10 + 1),
              severity: hasCritical ? "CRITICAL" : "MEDIUM",
              alertType: "allergy",
              message: `アレルギー: ${parsed.map((a: { name: string }) => a.name).join(", ")}`,
            });
          } catch { /* ignore */ }
        }

        const alertOccasion = rand() < 0.5 ? pick(OCCASIONS) : null;
        if (alertOccasion && ["記念日", "誕生日"].includes(alertOccasion)) {
          alerts.push({
            id: uuid(50000 + rsvIdx * 10 + 2),
            severity: "MEDIUM",
            alertType: "anniversary",
            message: `${alertOccasion}のご利用です。サプライズ演出の確認をお願いします。`,
          });
        }
      }

      const occasion = rand() < 0.5 ? pick(OCCASIONS) : null;

      // Slim customer for reservation (avoid circular ref via empty reservations)
      const rsvCustomer: CustomerDetail = {
        ...customer,
        reservations: [],
      };

      const rsv: ReservationDetail = {
        id: uuid(30000 + rsvIdx),
        dateTime: dateTime.toISOString(),
        partySize,
        status,
        courseName: course.name,
        tableLabel: rand() < 0.6 ? pick(TABLES) : null,
        occasion,
        shop,
        customer: rsvCustomer,
        alerts,
        specialRequests: rand() < 0.3
          ? pick([
            "窓際の個室を希望",
            "バースデーケーキをご用意ください（名前: 美智子）",
            "アレルギー情報は顧客プロフィールを参照",
            "ワインペアリングを事前にソムリエと相談したい",
            "お花をテーブルに飾ってほしい（予算1万円）",
            "同行者に外国人あり。英語メニュー希望",
          ])
          : null,
        internalMemo: rand() < 0.2
          ? pick([
            "前回の来店で料理長が挨拶済み",
            "社長就任祝いのご利用",
            "雑誌の取材を兼ねた会食",
          ])
          : null,
        source: pick(SOURCES),
        companions: null,
      };

      all.push(rsv);
      customerReservations.push(rsv);

      if (isToday) {
        today.push(rsv);
      }

      rsvIdx++;
    }

    // Attach reservations to customer, sorted by date descending
    customer.reservations = customerReservations.sort(
      (a, b) => new Date(b.dateTime).getTime() - new Date(a.dateTime).getTime()
    );
    customer._count = { reservations: customerReservations.length };
  }

  // Sort today by time
  today.sort((a, b) => new Date(a.dateTime).getTime() - new Date(b.dateTime).getTime());

  return { all, today };
}

const { all: allReservations, today: todayReservations } = generateReservations();
export { allReservations, todayReservations };

// ============================================================
// Duplicate Candidates
// ============================================================
export const duplicateCandidates: DuplicateCandidate[] = [];
for (let k = 0; k < 5; k++) {
  const c1 = allCustomers[k * 2];
  const c2 = allCustomers[k * 2 + 1];
  duplicateCandidates.push({
    id: uuid(40000 + k),
    primaryId: c1.id,
    secondaryId: c2.id,
    confidenceScore: 0.35 + (k * 0.12),
    matchReasons: JSON.stringify(pick([["phone"], ["email", "name"], ["name_kana"], ["phone", "name"]])),
    primary: {
      id: c1.id,
      lastName: c1.lastName,
      firstName: c1.firstName,
      lastNameKana: c1.lastNameKana,
      firstNameKana: c1.firstNameKana,
      phone: c1.phone,
      email: c1.email,
      companyName: c1.companyName,
      language: c1.language,
      tags: c1.tags,
    },
    secondary: {
      id: c2.id,
      lastName: c2.lastName,
      firstName: c2.firstName,
      lastNameKana: c2.lastNameKana,
      firstNameKana: c2.firstNameKana,
      phone: c2.phone,
      email: c2.email,
      companyName: c2.companyName,
      language: c2.language,
      tags: c2.tags,
    },
  });
}

// ============================================================
// Dashboard Stats
// ============================================================
export const dashboardStats: DashboardStats = {
  todayReservations: todayReservations.length,
  totalCustomers: 100,
  pendingDuplicates: 5,
  recentNoShows: allReservations.filter((r) => r.status === "NO_SHOW").length,
  vipCount: allCustomers.filter((c) => c.tags.some((t) => t.tagDefinition.slug === "vip" || t.tagDefinition.slug === "vvip")).length,
  avgProfileCompleteness: Math.round(
    allCustomers.reduce((sum, c) => sum + (c.profileCompleteness ?? 0), 0) / allCustomers.length * 100
  ),
  duplicateRate: 5,
};

// ============================================================
// Sync States
// ============================================================
const now = new Date().toISOString();
export const syncStates: SyncState[] = [
  { id: uuid(7001), objectType: "customer", status: "idle", lastSyncAt: now, lastCursor: null, errorMessage: null, recordsSynced: 100 },
  { id: uuid(7002), objectType: "reservation", status: "idle", lastSyncAt: now, lastCursor: null, errorMessage: null, recordsSynced: allReservations.length },
  { id: uuid(7003), objectType: "shop", status: "idle", lastSyncAt: now, lastCursor: null, errorMessage: null, recordsSynced: 3 },
];

// ============================================================
// Helper: build pagination
// ============================================================
export function paginate<T>(items: T[], page: number, limit = 20): { data: T[]; pagination: Pagination } {
  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const p = Math.max(1, Math.min(page, totalPages));
  const start = (p - 1) * limit;
  return {
    data: items.slice(start, start + limit),
    pagination: { page: p, limit, total, totalPages },
  };
}
