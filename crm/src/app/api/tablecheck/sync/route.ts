import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyWebhookSignature } from "@/lib/tablecheck";

export async function POST(req: NextRequest) {
  try {
    const body = await req.text();
    const signature = req.headers.get("x-tablecheck-signature") || req.headers.get("x-webhook-secret") || "";

    // Verify signature
    if (!verifyWebhookSignature(body, signature)) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    const payload = JSON.parse(body);
    const eventType = payload.event_type || payload.type || "unknown";
    const objectType = payload.object_type || (eventType.startsWith("reservation") ? "reservation" : "customer");
    const objectId = payload.object_id || payload.data?.id || "unknown";

    // Store event (idempotent - same objectId+eventType within 5 seconds is ignored)
    await prisma.syncEvent.create({
      data: {
        eventType,
        objectType,
        objectId: String(objectId),
        payload: body,
        status: "pending",
      },
    });

    return NextResponse.json({ received: true });
  } catch (err) {
    console.error("Webhook error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
