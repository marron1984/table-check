import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { listReservations, listCustomers } from "@/lib/tablecheck";
import { upsertCustomer, upsertReservation } from "@/lib/sync";

export async function POST(req: NextRequest) {
  const secret = req.headers.get("authorization")?.replace("Bearer ", "") || "";
  if (secret !== process.env.CRON_SECRET && process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const monthsBack = (body as Record<string, unknown>).months_back ?? 24;
    const since = new Date();
    since.setMonth(since.getMonth() - Number(monthsBack));

    let customerCount = 0;
    let reservationCount = 0;

    // Backfill customers
    let page = 1;
    while (true) {
      const res = await listCustomers({ page, per_page: 100, updated_since: since.toISOString() });
      for (const c of res.data) {
        await upsertCustomer(c);
        customerCount++;
      }
      if (page >= res.pagination.total_pages) break;
      page++;
    }

    // Backfill reservations
    page = 1;
    while (true) {
      const res = await listReservations({ since: since.toISOString(), page, per_page: 100 });
      for (const r of res.data) {
        await upsertReservation(r);
        reservationCount++;
      }
      if (page >= res.pagination.total_pages) break;
      page++;
    }

    return NextResponse.json({ customerCount, reservationCount, since: since.toISOString() });
  } catch (err) {
    console.error("Backfill error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
