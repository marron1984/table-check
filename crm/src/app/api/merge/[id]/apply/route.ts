import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { updateCustomerStats } from "@/lib/sync";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const candidate = await prisma.mergeCandidate.findUnique({
    where: { id },
    include: { customerA: true, customerB: true },
  });

  if (!candidate || candidate.status !== "pending") {
    return NextResponse.json({ error: "Not found or already resolved" }, { status: 404 });
  }

  // Merge B into A (A is the canonical)
  const canonicalId = candidate.customerAId;
  const mergedId = candidate.customerBId;

  await prisma.$transaction(async (tx) => {
    // Move all reservations from B to A
    await tx.reservation.updateMany({
      where: { customerId: mergedId },
      data: { customerId: canonicalId },
    });

    // Move all customer sources from B to A
    await tx.customerSource.updateMany({
      where: { customerId: mergedId },
      data: { customerId: canonicalId },
    });

    // Move tags (skip duplicates)
    const existingTags = await tx.customerTag.findMany({ where: { customerId: canonicalId } });
    const existingTagIds = new Set(existingTags.map((t) => t.tagId));
    const tagsToMove = await tx.customerTag.findMany({ where: { customerId: mergedId } });
    for (const tag of tagsToMove) {
      if (!existingTagIds.has(tag.tagId)) {
        await tx.customerTag.update({
          where: { customerId_tagId: { customerId: mergedId, tagId: tag.tagId } },
          data: { customerId: canonicalId },
        });
      } else {
        await tx.customerTag.delete({
          where: { customerId_tagId: { customerId: mergedId, tagId: tag.tagId } },
        });
      }
    }

    // Move notes
    await tx.reservationNote.updateMany({
      where: { customerId: mergedId },
      data: { customerId: canonicalId },
    });

    // Mark B as merged
    await tx.customer.update({
      where: { id: mergedId },
      data: { mergedIntoId: canonicalId },
    });

    // Update merge candidate
    await tx.mergeCandidate.update({
      where: { id },
      data: { status: "merged", resolvedBy: session.id, resolvedAt: new Date() },
    });

    // Resolve other pending candidates involving the merged customer
    await tx.mergeCandidate.updateMany({
      where: {
        OR: [{ customerAId: mergedId }, { customerBId: mergedId }],
        status: "pending",
      },
      data: { status: "rejected", resolvedBy: session.id, resolvedAt: new Date() },
    });
  });

  // Update stats for canonical customer
  await updateCustomerStats(canonicalId);

  await logAudit({
    userId: session.id,
    action: "merge",
    entityType: "customer",
    entityId: canonicalId,
    detail: { mergedFrom: mergedId, mergeCandidateId: id },
  });

  return NextResponse.json({ success: true, canonicalId });
}
