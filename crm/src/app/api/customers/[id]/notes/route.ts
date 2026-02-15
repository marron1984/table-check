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
  const content = (body as Record<string, unknown>).content as string;
  const reservationId = (body as Record<string, unknown>).reservationId as string | undefined;

  if (!content?.trim()) {
    return NextResponse.json({ error: "Content required" }, { status: 400 });
  }

  const note = await prisma.reservationNote.create({
    data: {
      customerId: id,
      reservationId: reservationId || null,
      content: content.trim(),
      authorName: session.displayName,
    },
  });

  await logAudit({
    userId: session.id,
    action: "edit",
    entityType: "customer",
    entityId: id,
    detail: { type: "note_added", noteId: note.id },
  });

  return NextResponse.json({ data: note });
}
