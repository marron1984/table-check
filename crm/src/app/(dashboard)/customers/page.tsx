import { prisma } from "@/lib/prisma";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; tag?: string; page?: string }>;
}) {
  const params = await searchParams;
  const q = params.q || "";
  const tag = params.tag || "";
  const page = parseInt(params.page || "1", 10);
  const perPage = 20;

  const where: Record<string, unknown> = {
    mergedIntoId: null,
    deletedAt: null,
  };

  if (q) {
    where.OR = [
      { displayName: { contains: q } },
      { kanaName: { contains: q } },
      { email: { contains: q.toLowerCase() } },
      { phone: { contains: q } },
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

  const totalPages = Math.ceil(total / perPage);

  return (
    <div>
      <h1 className="text-xl font-bold mb-4">顧客管理</h1>

      {/* Search */}
      <form className="mb-4">
        <div className="flex gap-2">
          <input
            name="q"
            type="text"
            defaultValue={q}
            placeholder="名前・電話・メールで検索..."
            className="flex-1 h-10 rounded-md border border-input bg-background px-3 text-sm"
          />
          <button
            type="submit"
            className="h-10 px-4 rounded-md bg-primary text-primary-foreground text-sm font-medium"
          >
            検索
          </button>
        </div>
      </form>

      {/* Results */}
      <p className="text-sm text-muted-foreground mb-3">
        {total}件の顧客{q && ` (「${q}」で検索)`}
      </p>

      <div className="space-y-2">
        {customers.map((c) => (
          <Link key={c.id} href={`/customers/${c.id}`}>
            <Card className="hover:bg-muted/50 transition-colors cursor-pointer">
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="font-semibold">{c.displayName}</div>
                    {c.kanaName && (
                      <div className="text-xs text-muted-foreground">{c.kanaName}</div>
                    )}
                    <div className="text-xs text-muted-foreground mt-1">
                      {c.phone && <span className="mr-3">{c.phone}</span>}
                      {c.email && <span>{c.email}</span>}
                    </div>
                    <div className="flex gap-1 mt-2">
                      {c.tags?.map((ct) => (
                        <Badge key={ct.tagId} variant="outline" className="text-xs">
                          {ct.tag.label}
                        </Badge>
                      ))}
                      {c.allergySeverity === "severe" && (
                        <Badge variant="destructive">重大アレルギー</Badge>
                      )}
                    </div>
                  </div>
                  <div className="text-right text-xs text-muted-foreground shrink-0">
                    <div>来店 {c.visitsCount}回</div>
                    {c.lastVisitAt && (
                      <div>最終: {new Date(c.lastVisitAt).toLocaleDateString("ja-JP")}</div>
                    )}
                    {c.noShowCount > 0 && (
                      <div className="text-destructive">NS: {c.noShowCount}</div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center gap-2 mt-6">
          {page > 1 && (
            <a
              href={`/customers?q=${q}&tag=${tag}&page=${page - 1}`}
              className="px-3 py-1 rounded border text-sm"
            >
              前へ
            </a>
          )}
          <span className="px-3 py-1 text-sm text-muted-foreground">
            {page} / {totalPages}
          </span>
          {page < totalPages && (
            <a
              href={`/customers?q=${q}&tag=${tag}&page=${page + 1}`}
              className="px-3 py-1 rounded border text-sm"
            >
              次へ
            </a>
          )}
        </div>
      )}
    </div>
  );
}
