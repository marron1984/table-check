import { prisma } from "@/lib/prisma";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

export default async function MergeQueuePage() {
  const candidates = await prisma.mergeCandidate.findMany({
    where: { status: "pending" },
    include: {
      customerA: true,
      customerB: true,
    },
    orderBy: { score: "desc" },
    take: 50,
  });

  return (
    <div>
      <h1 className="text-xl font-bold mb-4">統合キュー</h1>
      <p className="text-sm text-muted-foreground mb-4">
        {candidates.length}件の統合候補
      </p>

      {candidates.length === 0 && (
        <p className="text-center text-muted-foreground py-12">統合候補はありません</p>
      )}

      <div className="space-y-3">
        {candidates.map((mc) => {
          const reasons = JSON.parse(mc.reasons || "[]") as string[];
          return (
            <Card key={mc.id}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <Badge variant={mc.score >= 0.9 ? "success" : mc.score >= 0.7 ? "warning" : "outline"}>
                    スコア: {(mc.score * 100).toFixed(0)}%
                  </Badge>
                  <div className="flex gap-1">
                    {reasons.map((r, i) => (
                      <Badge key={i} variant="outline" className="text-xs">
                        {r.replace("_", " ")}
                      </Badge>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 mb-3">
                  <CustomerSummary customer={mc.customerA} label="A" />
                  <CustomerSummary customer={mc.customerB} label="B" />
                </div>

                <div className="flex gap-2 justify-end">
                  <form action={`/api/merge/${mc.id}/reject`} method="POST">
                    <button
                      type="submit"
                      className="px-3 py-1.5 text-sm border rounded-md hover:bg-muted"
                    >
                      却下
                    </button>
                  </form>
                  <form action={`/api/merge/${mc.id}/apply`} method="POST">
                    <button
                      type="submit"
                      className="px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
                    >
                      統合 (B→A)
                    </button>
                  </form>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function CustomerSummary({ customer, label }: {
  customer: { displayName: string; phone: string | null; email: string | null; visitsCount: number };
  label: string;
}) {
  return (
    <div className="border rounded p-3">
      <div className="text-xs text-muted-foreground mb-1">顧客 {label}</div>
      <div className="font-semibold text-sm">{customer.displayName}</div>
      <div className="text-xs text-muted-foreground mt-1">
        {customer.phone && <div>{customer.phone}</div>}
        {customer.email && <div>{customer.email}</div>}
        <div>来店 {customer.visitsCount}回</div>
      </div>
    </div>
  );
}
