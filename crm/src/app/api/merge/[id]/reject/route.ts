import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { logAudit } from "@/lib/audit";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  await prisma.mergeCandidate.update({
    where: { id },
    data: { status: "rejected", resolvedBy: session.id, resolvedAt: new Date() },
  });

  await logAudit({
    userId: session.id,
    action: "merge",
    entityType: "mergeCandidate",
    entityId: id,
    detail: { action: "rejected" },
  });

  return NextResponse.json({ success: true });
}
