import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

export default async function CustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const customer = await prisma.customer.findUnique({
    where: { id },
    include: {
      tags: { include: { tag: true } },
      sources: true,
      notes: { orderBy: { createdAt: "desc" }, take: 20 },
      reservations: {
        orderBy: { startsAt: "desc" },
        take: 30,
        include: { store: true },
      },
    },
  });

  if (!customer) notFound();

  const preferences = JSON.parse(customer.preferences || "{}");

  return (
    <div>
      <a href="/customers" className="text-sm text-primary hover:underline mb-2 inline-block">
        ← 顧客一覧に戻る
      </a>

      {/* Profile Header */}
      <Card className="mb-4">
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="text-xl">{customer.displayName}</CardTitle>
              {customer.kanaName && (
                <p className="text-sm text-muted-foreground">{customer.kanaName}</p>
              )}
            </div>
            <div className="flex gap-1 flex-wrap justify-end">
              {customer.tags.map((ct) => (
                <Badge key={ct.tagId} variant="outline">{ct.tag.label}</Badge>
              ))}
              {customer.allergySeverity === "severe" && (
                <Badge variant="destructive">重大アレルギー</Badge>
              )}
              {customer.allergySeverity === "light" && (
                <Badge variant="warning">軽アレルギー</Badge>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground block text-xs">電話</span>
              {customer.phone || "—"}
            </div>
            <div>
              <span className="text-muted-foreground block text-xs">メール</span>
              {customer.email || "—"}
            </div>
            <div>
              <span className="text-muted-foreground block text-xs">地域</span>
              {customer.region || customer.locale || "—"}
            </div>
            <div>
              <span className="text-muted-foreground block text-xs">ID</span>
              <span className="font-mono text-xs">{customer.id.slice(0, 12)}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
        <StatCard label="来店回数" value={String(customer.visitsCount)} />
        <StatCard label="最終来店" value={customer.lastVisitAt ? new Date(customer.lastVisitAt).toLocaleDateString("ja-JP") : "—"} />
        <StatCard label="累計売上" value={customer.totalSpendApprox ? `¥${customer.totalSpendApprox.toLocaleString()}` : "—"} />
        <StatCard label="キャンセル" value={String(customer.cancelCount)} warning={customer.cancelCount > 2} />
        <StatCard label="ノーショー" value={String(customer.noShowCount)} warning={customer.noShowCount > 0} />
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {/* Preferences */}
        <Card>
          <CardHeader><CardTitle className="text-base">嗜好・メモ</CardTitle></CardHeader>
          <CardContent>
            {Object.keys(preferences).length > 0 ? (
              <dl className="space-y-1 text-sm">
                {Object.entries(preferences).map(([k, v]) => (
                  <div key={k} className="flex gap-2">
                    <dt className="text-muted-foreground min-w-[80px]">{k}</dt>
                    <dd>{String(v)}</dd>
                  </div>
                ))}
              </dl>
            ) : (
              <p className="text-sm text-muted-foreground">嗜好データなし</p>
            )}
          </CardContent>
        </Card>

        {/* Notes */}
        <Card>
          <CardHeader><CardTitle className="text-base">現場メモ</CardTitle></CardHeader>
          <CardContent>
            {customer.notes.length === 0 ? (
              <p className="text-sm text-muted-foreground">メモなし</p>
            ) : (
              <div className="space-y-2">
                {customer.notes.map((n) => (
                  <div key={n.id} className="text-sm border-l-2 pl-3 py-1">
                    <p>{n.content}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {n.authorName} · {new Date(n.createdAt).toLocaleDateString("ja-JP")}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Reservation History */}
      <Card className="mt-4">
        <CardHeader><CardTitle className="text-base">来店履歴</CardTitle></CardHeader>
        <CardContent>
          {customer.reservations.length === 0 ? (
            <p className="text-sm text-muted-foreground">来店履歴なし</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="pb-2 font-medium text-muted-foreground">日時</th>
                    <th className="pb-2 font-medium text-muted-foreground">店舗</th>
                    <th className="pb-2 font-medium text-muted-foreground">人数</th>
                    <th className="pb-2 font-medium text-muted-foreground">コース</th>
                    <th className="pb-2 font-medium text-muted-foreground">ステータス</th>
                  </tr>
                </thead>
                <tbody>
                  {customer.reservations.map((r) => (
                    <tr key={r.id} className="border-b last:border-0">
                      <td className="py-2">
                        {new Date(r.startsAt).toLocaleDateString("ja-JP")}{" "}
                        {new Date(r.startsAt).toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" })}
                      </td>
                      <td className="py-2">{r.store.name}</td>
                      <td className="py-2">{r.partySize}名</td>
                      <td className="py-2">{r.courseName || "—"}</td>
                      <td className="py-2">
                        <StatusBadge status={r.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Sources */}
      {customer.sources.length > 0 && (
        <Card className="mt-4">
          <CardHeader><CardTitle className="text-base">データソース</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-1 text-xs text-muted-foreground">
              {customer.sources.map((s) => (
                <div key={s.id}>
                  TableCheck ID: <span className="font-mono">{s.externalId}</span>
                  <span className="ml-2">
                    (取込: {new Date(s.createdAt).toLocaleDateString("ja-JP")})
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function StatCard({ label, value, warning }: { label: string; value: string; warning?: boolean }) {
  return (
    <Card>
      <CardContent className="p-3 text-center">
        <div className={`text-lg font-bold ${warning ? "text-destructive" : ""}`}>{value}</div>
        <div className="text-xs text-muted-foreground">{label}</div>
      </CardContent>
    </Card>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; variant: "default" | "success" | "warning" | "destructive" | "outline" }> = {
    confirmed: { label: "確定", variant: "default" },
    seated: { label: "着席", variant: "success" },
    completed: { label: "完了", variant: "outline" },
    cancelled: { label: "キャンセル", variant: "warning" },
    no_show: { label: "ノーショー", variant: "destructive" },
  };
  const config = map[status] || { label: status, variant: "outline" as const };
  return <Badge variant={config.variant}>{config.label}</Badge>;
}
