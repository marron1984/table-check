import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { normalizePhone } from "@/lib/normalize";

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q") || "";
  const tag = req.nextUrl.searchParams.get("tag") || "";
  const page = parseInt(req.nextUrl.searchParams.get("page") || "1", 10);
  const perPage = 20;

  const where: Record<string, unknown> = {
    mergedIntoId: null,
    deletedAt: null,
  };

  if (q) {
    const phoneNorm = normalizePhone(q);
    where.OR = [
      { displayName: { contains: q } },
      { kanaName: { contains: q } },
      { email: { contains: q.toLowerCase() } },
      { phone: { contains: q } },
      ...(phoneNorm ? [{ phoneNormalized: phoneNorm }] : []),
    ];
  }

  if (tag) {
    where.tags = { some: { tag: { slug: tag } } };
  }

  const [customers, total] = await Promise.all([
    prisma.customer.findMany({
      where: where as any,
      include: { tags: { include: { tag: true } } },
      orderBy: { updatedAt: "desc" },
      skip: (page - 1) * perPage,
      take: perPage,
    }),
    prisma.customer.count({ where: where as any }),
  ]);

  return NextResponse.json({
    data: customers,
    pagination: { total, page, perPage, totalPages: Math.ceil(total / perPage) },
  });
}
