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
  const body = await req.json();
  const tagId = (body as Record<string, unknown>).tagId as string;
  const action = (body as Record<string, unknown>).action as string; // "assign" | "remove"

  if (!tagId) {
    return NextResponse.json({ error: "tagId required" }, { status: 400 });
  }

  if (action === "remove") {
    await prisma.customerTag.deleteMany({
      where: { customerId: id, tagId },
    });
  } else {
    await prisma.customerTag.upsert({
      where: { customerId_tagId: { customerId: id, tagId } },
      create: { customerId: id, tagId, assignedBy: session.id },
      update: { assignedBy: session.id },
    });
  }

  await logAudit({
    userId: session.id,
    action: "edit",
    entityType: "customer",
    entityId: id,
    detail: { type: action === "remove" ? "tag_removed" : "tag_assigned", tagId },
  });

  return NextResponse.json({ success: true });
}
