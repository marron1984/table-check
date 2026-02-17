import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { normalizePhone, normalizeEmail, normalizeName, nameSimilarity } from "@/lib/normalize";

/**
 * TableCheck CSVインポート
 * 列: ランキング, 予約組数, 氏（アア）, 名（アア）, 氏（漢字）, 名（漢字）,
 *     電話, Eメール, 性別, 総来店回数, 期間内来店回数, 次回の来店, 前回の来店,
 *     営業担当, 顧客タグ
 */

interface CsvRow {
  ranking: string;
  reservationCount: string;
  lastNameKana: string;
  firstNameKana: string;
  lastNameKanji: string;
  firstNameKanji: string;
  phone: string;
  email: string;
  gender: string;
  totalVisits: string;
  periodVisits: string;
  nextVisit: string;
  lastVisit: string;
  salesRep: string;
  customerTag: string;
}

const MERGE_NAME_THRESHOLD = 0.7;

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') {
        current += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ",") {
        result.push(current.trim());
        current = "";
      } else {
        current += ch;
      }
    }
  }
  result.push(current.trim());
  return result;
}

function parseGender(val: string): string | null {
  const v = val.trim();
  if (!v || v === "-" || v === "不明") return null;
  if (v === "男性" || v === "男" || v.toLowerCase() === "male") return "male";
  if (v === "女性" || v === "女" || v.toLowerCase() === "female") return "female";
  return "other";
}

function parseDate(val: string): Date | null {
  if (!val || val === "-") return null;
  const d = new Date(val);
  return isNaN(d.getTime()) ? null : d;
}

function parseCsvRows(text: string): CsvRow[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return [];

  // Skip header row
  const rows: CsvRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = parseCsvLine(lines[i]);
    if (cols.length < 15) continue;

    rows.push({
      ranking: cols[0],
      reservationCount: cols[1],
      lastNameKana: cols[2],
      firstNameKana: cols[3],
      lastNameKanji: cols[4],
      firstNameKanji: cols[5],
      phone: cols[6],
      email: cols[7],
      gender: cols[8],
      totalVisits: cols[9],
      periodVisits: cols[10],
      nextVisit: cols[11],
      lastVisit: cols[12],
      salesRep: cols[13],
      customerTag: cols[14],
    });
  }
  return rows;
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireRole("admin", "manager");

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    if (!file) {
      return NextResponse.json({ error: "ファイルが選択されていません" }, { status: 400 });
    }

    const text = await file.text();
    const rows = parseCsvRows(text);
    if (rows.length === 0) {
      return NextResponse.json({ error: "有効なデータ行がありません" }, { status: 400 });
    }

    let created = 0;
    let updated = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const row of rows) {
      try {
        const displayName = normalizeName(
          `${row.lastNameKanji} ${row.firstNameKanji}`.trim()
        );
        const kanaName = row.lastNameKana || row.firstNameKana
          ? normalizeName(`${row.lastNameKana} ${row.firstNameKana}`.trim())
          : null;

        if (!displayName) {
          skipped++;
          continue;
        }

        const phoneNorm = normalizePhone(row.phone);
        const emailNorm = normalizeEmail(row.email);
        const gender = parseGender(row.gender);
        const totalVisits = parseInt(row.totalVisits, 10) || 0;
        const lastVisitAt = parseDate(row.lastVisit);
        const salesRep = row.salesRep?.trim() || null;

        // Identity resolution: phone → email → name
        let existing = null;
        if (phoneNorm) {
          existing = await prisma.customer.findFirst({
            where: { phoneNormalized: phoneNorm, mergedIntoId: null, deletedAt: null },
          });
        }
        if (!existing && emailNorm) {
          existing = await prisma.customer.findFirst({
            where: { emailNormalized: emailNorm, mergedIntoId: null, deletedAt: null },
          });
        }

        if (existing) {
          // Update existing customer
          await prisma.customer.update({
            where: { id: existing.id },
            data: {
              displayName,
              kanaName: kanaName || existing.kanaName,
              email: row.email || existing.email,
              emailNormalized: emailNorm || existing.emailNormalized,
              phone: row.phone || existing.phone,
              phoneNormalized: phoneNorm || existing.phoneNormalized,
              gender: gender || existing.gender,
              salesRep: salesRep || existing.salesRep,
              visitsCount: Math.max(totalVisits, existing.visitsCount),
              lastVisitAt: lastVisitAt && (!existing.lastVisitAt || lastVisitAt > existing.lastVisitAt)
                ? lastVisitAt
                : existing.lastVisitAt,
            },
          });
          updated++;
        } else {
          // Create new customer
          const customer = await prisma.customer.create({
            data: {
              displayName,
              kanaName,
              email: row.email || null,
              emailNormalized: emailNorm,
              phone: row.phone || null,
              phoneNormalized: phoneNorm,
              gender,
              salesRep,
              visitsCount: totalVisits,
              lastVisitAt,
            },
          });

          // Check for merge candidates by name
          const candidates = await prisma.customer.findMany({
            where: {
              id: { not: customer.id },
              mergedIntoId: null,
              deletedAt: null,
            },
            take: 200,
          });

          for (const other of candidates) {
            const sim = nameSimilarity(displayName, other.displayName);
            if (sim >= MERGE_NAME_THRESHOLD) {
              const exists = await prisma.mergeCandidate.findFirst({
                where: {
                  OR: [
                    { customerAId: customer.id, customerBId: other.id },
                    { customerAId: other.id, customerBId: customer.id },
                  ],
                },
              });
              if (!exists) {
                await prisma.mergeCandidate.create({
                  data: {
                    customerAId: customer.id,
                    customerBId: other.id,
                    score: sim * 0.6,
                    reasons: JSON.stringify([`name_similar:${sim.toFixed(2)}`]),
                    status: "pending",
                  },
                });
              }
            }
          }

          created++;
        }

        // Handle customer tags
        if (row.customerTag?.trim()) {
          const tagLabels = row.customerTag.split(/[,、]/).map((t) => t.trim()).filter(Boolean);
          const customerId = existing?.id || (await prisma.customer.findFirst({
            where: { phoneNormalized: phoneNorm, mergedIntoId: null, deletedAt: null },
          }))?.id;

          if (customerId) {
            for (const label of tagLabels) {
              const slug = label.toLowerCase().replace(/\s+/g, "-");
              const tag = await prisma.tag.upsert({
                where: { slug },
                create: { slug, label, color: "#6b7280" },
                update: {},
              });
              await prisma.customerTag.upsert({
                where: { customerId_tagId: { customerId, tagId: tag.id } },
                create: { customerId, tagId: tag.id, assignedBy: "csv-import" },
                update: {},
              });
            }
          }
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        errors.push(`行 ${row.ranking || "?"}: ${msg}`);
        skipped++;
      }
    }

    // Audit log
    await prisma.auditLog.create({
      data: {
        userId: session.id,
        action: "import",
        entityType: "customer",
        detail: JSON.stringify({ created, updated, skipped, totalRows: rows.length }),
      },
    });

    return NextResponse.json({
      success: true,
      totalRows: rows.length,
      created,
      updated,
      skipped,
      errors: errors.slice(0, 10),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg === "Unauthorized" || msg === "Forbidden") {
      return NextResponse.json({ error: msg }, { status: msg === "Unauthorized" ? 401 : 403 });
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
