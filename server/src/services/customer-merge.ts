import { prisma } from "../db";
import { logger } from "../logger";
import { normalizePhone } from "../utils";

interface MatchScore {
  field: string;
  weight: number;
}

/**
 * 2つの顧客間の類似度スコアを計算する
 * 1.0 = 完全一致、0.0 = 一致なし
 */
function calculateConfidence(
  a: { phoneNormalized: string | null; email: string | null; lastName: string | null; firstName: string | null; lastNameKana: string | null; firstNameKana: string | null },
  b: { phoneNormalized: string | null; email: string | null; lastName: string | null; firstName: string | null; lastNameKana: string | null; firstNameKana: string | null }
): { score: number; reasons: string[] } {
  const matches: MatchScore[] = [];
  const reasons: string[] = [];

  // 電話番号一致（最も信頼度高い）
  if (a.phoneNormalized && b.phoneNormalized && a.phoneNormalized === b.phoneNormalized) {
    matches.push({ field: "phone", weight: 0.4 });
    reasons.push("phone");
  }

  // メール一致
  if (a.email && b.email && a.email.toLowerCase() === b.email.toLowerCase()) {
    matches.push({ field: "email", weight: 0.35 });
    reasons.push("email");
  }

  // 氏名（漢字）一致
  if (a.lastName && b.lastName && a.firstName && b.firstName) {
    if (a.lastName === b.lastName && a.firstName === b.firstName) {
      matches.push({ field: "name", weight: 0.15 });
      reasons.push("name");
    }
  }

  // 氏名（カナ）一致
  if (a.lastNameKana && b.lastNameKana && a.firstNameKana && b.firstNameKana) {
    if (a.lastNameKana === b.lastNameKana && a.firstNameKana === b.firstNameKana) {
      matches.push({ field: "name_kana", weight: 0.1 });
      reasons.push("name_kana");
    }
  }

  const score = matches.reduce((sum, m) => sum + m.weight, 0);
  return { score, reasons };
}

/**
 * 新しくUpsertされた顧客に対して重複候補を検出し、保留キューに積む
 */
export async function detectDuplicates(customerId: string): Promise<number> {
  const target = await prisma.customer.findUnique({ where: { id: customerId } });
  if (!target || target.mergedIntoId) return 0;

  // 電話番号 or メール or 名前が一致する候補を検索
  const candidates = await prisma.customer.findMany({
    where: {
      id: { not: customerId },
      mergedIntoId: null,
      OR: [
        target.phoneNormalized ? { phoneNormalized: target.phoneNormalized } : {},
        target.email ? { email: target.email } : {},
        target.lastName && target.firstName
          ? { lastName: target.lastName, firstName: target.firstName }
          : {},
        target.lastNameKana && target.firstNameKana
          ? { lastNameKana: target.lastNameKana, firstNameKana: target.firstNameKana }
          : {},
      ].filter((c) => Object.keys(c).length > 0),
    },
    take: 50,
  });

  let created = 0;
  for (const candidate of candidates) {
    const { score, reasons } = calculateConfidence(target, candidate);

    if (score < 0.3) continue; // 低スコアは無視

    // 既存の重複候補があるかチェック
    const existing = await prisma.duplicateCandidate.findFirst({
      where: {
        OR: [
          { primaryId: customerId, secondaryId: candidate.id },
          { primaryId: candidate.id, secondaryId: customerId },
        ],
      },
    });

    if (existing) continue;

    // 自動マージ閾値: 0.75以上
    if (score >= 0.75) {
      // 確信度が高い → 自動マージ実行
      await mergeCustomers(customerId, candidate.id, "auto");
      logger.info(`Auto-merged customers ${customerId} <- ${candidate.id}`, { score, reasons });
    } else {
      // 確信度が中程度 → 保留キューに追加
      await prisma.duplicateCandidate.create({
        data: {
          primaryId: customerId,
          secondaryId: candidate.id,
          confidenceScore: score,
          matchReasons: JSON.stringify(reasons),
          status: "PENDING",
        },
      });
      created++;
    }
  }

  return created;
}

/**
 * 顧客マージ実行
 * secondary → primary に統合。予約履歴・タグ等を引き継ぎ。
 */
export async function mergeCustomers(
  primaryId: string,
  secondaryId: string,
  resolvedBy: string
): Promise<void> {
  logger.info(`Merging customer ${secondaryId} into ${primaryId}`, { resolvedBy });

  await prisma.$transaction(async (tx) => {
    const primary = await tx.customer.findUnique({ where: { id: primaryId } });
    const secondary = await tx.customer.findUnique({ where: { id: secondaryId } });

    if (!primary || !secondary) {
      throw new Error("One or both customers not found");
    }

    // 予約をprimaryに付け替え
    await tx.reservation.updateMany({
      where: { customerId: secondaryId },
      data: { customerId: primaryId },
    });

    // タグをprimaryに移行（重複は無視）
    const secondaryTags = await tx.customerTag.findMany({ where: { customerId: secondaryId } });
    for (const tag of secondaryTags) {
      const exists = await tx.customerTag.findUnique({
        where: { customerId_tagDefinitionId: { customerId: primaryId, tagDefinitionId: tag.tagDefinitionId } },
      });
      if (!exists) {
        await tx.customerTag.update({
          where: { id: tag.id },
          data: { customerId: primaryId },
        });
      } else {
        await tx.customerTag.delete({ where: { id: tag.id } });
      }
    }

    // メンバーシップを移行
    await tx.membership.updateMany({
      where: { customerId: secondaryId },
      data: { customerId: primaryId },
    });

    // primaryの欠損フィールドをsecondaryから補完
    const updates: Record<string, unknown> = {};
    const fields = [
      "email", "phone", "phoneNormalized", "lastName", "firstName",
      "lastNameKana", "firstNameKana", "lastNameEn", "firstNameEn",
      "language", "country", "companyName", "companyRole",
      "allergies", "dietaryRestrictions", "preferences",
      "secretaryName", "secretaryPhone", "secretaryEmail",
      "referrerName", "conciergeName", "conciergeSource",
    ] as const;

    for (const field of fields) {
      if (!primary[field] && secondary[field]) {
        updates[field] = secondary[field];
      }
    }

    if (Object.keys(updates).length > 0) {
      await tx.customer.update({ where: { id: primaryId }, data: updates });
    }

    // secondaryにマージ先を記録
    await tx.customer.update({
      where: { id: secondaryId },
      data: { mergedIntoId: primaryId },
    });

    // マージ履歴
    await tx.customerHistory.create({
      data: {
        customerId: primaryId,
        field: "merge",
        oldValue: null,
        newValue: secondaryId,
        changedBy: resolvedBy,
      },
    });

    // 重複候補のステータスを更新
    await tx.duplicateCandidate.updateMany({
      where: {
        OR: [
          { primaryId, secondaryId },
          { primaryId: secondaryId, secondaryId: primaryId },
        ],
        status: "PENDING",
      },
      data: { status: "MERGED", resolvedBy, resolvedAt: new Date() },
    });
  });
}

/**
 * 重複候補を却下
 */
export async function rejectDuplicate(duplicateId: string, resolvedBy: string): Promise<void> {
  await prisma.duplicateCandidate.update({
    where: { id: duplicateId },
    data: { status: "REJECTED", resolvedBy, resolvedAt: new Date() },
  });
}
