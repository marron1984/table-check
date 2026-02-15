import { NextRequest, NextResponse } from "next/server";
import { processPendingEvents } from "@/lib/sync";

export async function POST(req: NextRequest) {
  // Verify cron secret
  const secret = req.headers.get("authorization")?.replace("Bearer ", "") || "";
  if (secret !== process.env.CRON_SECRET && process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await processPendingEvents(50);
    return NextResponse.json(result);
  } catch (err) {
    console.error("Process sync error:", err);
    return NextResponse.json({ error: "Processing failed" }, { status: 500 });
  }
}
