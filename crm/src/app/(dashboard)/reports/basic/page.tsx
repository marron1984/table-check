import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default async function ReportsPage() {
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const [
    totalCustomers,
    totalReservations,
    recentReservations,
    completedCount,
    cancelledCount,
    noShowCount,
  ] = await Promise.all([
    prisma.customer.count({ where: { mergedIntoId: null, deletedAt: null } }),
    prisma.reservation.count({ where: { deletedAt: null } }),
    prisma.reservation.count({
      where: { startsAt: { gte: thirtyDaysAgo }, deletedAt: null },
    }),
    prisma.reservation.count({
      where: { startsAt: { gte: thirtyDaysAgo }, status: { in: ["completed", "seated"] }, deletedAt: null },
    }),
    prisma.reservation.count({
      where: { startsAt: { gte: thirtyDaysAgo }, status: "cancelled", deletedAt: null },
    }),
    prisma.reservation.count({
      where: { startsAt: { gte: thirtyDaysAgo }, status: "no_show", deletedAt: null },
    }),
  ]);

  const cancelRate = recentReservations > 0
    ? ((cancelledCount / recentReservations) * 100).toFixed(1)
    : "0.0";
  const noShowRate = recentReservations > 0
    ? ((noShowCount / recentReservations) * 100).toFixed(1)
    : "0.0";
  const completionRate = recentReservations > 0
    ? ((completedCount / recentReservations) * 100).toFixed(1)
    : "0.0";

  // Channel breakdown
  const channels = await prisma.reservation.groupBy({
    by: ["channel"],
    where: { startsAt: { gte: thirtyDaysAgo }, deletedAt: null },
    _count: { id: true },
    orderBy: { _count: { id: "desc" } },
  });

  // Sync status
  const pendingEvents = await prisma.syncEvent.count({ where: { status: "pending" } });
  const failedEvents = await prisma.syncEvent.count({ where: { status: "failed" } });

  return (
    <div>
      <h1 className="text-xl font-bold mb-4">基本レポート</h1>
      <p className="text-sm text-muted-foreground mb-6">直近30日間の集計</p>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <KPICard label="総顧客数" value={totalCustomers.toLocaleString()} />
        <KPICard label="総予約数" value={totalReservations.toLocaleString()} />
        <KPICard label="直近30日予約" value={recentReservations.toLocaleString()} />
        <KPICard label="来店完了率" value={`${completionRate}%`} />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-6">
        <KPICard label="キャンセル率" value={`${cancelRate}%`} sub={`${cancelledCount}件`} />
        <KPICard label="ノーショー率" value={`${noShowRate}%`} sub={`${noShowCount}件`} />
        <KPICard label="来店完了" value={String(completedCount)} sub="件" />
      </div>

      {/* Channel breakdown */}
      <Card className="mb-4">
        <CardHeader><CardTitle className="text-base">チャネル構成 (30日)</CardTitle></CardHeader>
        <CardContent>
          {channels.length === 0 ? (
            <p className="text-sm text-muted-foreground">データなし</p>
          ) : (
            <div className="space-y-2">
              {channels.map((ch) => (
                <div key={ch.channel || "unknown"} className="flex items-center gap-3">
                  <span className="text-sm min-w-[100px]">{ch.channel || "不明"}</span>
                  <div className="flex-1 h-4 bg-muted rounded overflow-hidden">
                    <div
                      className="h-full bg-primary/60 rounded"
                      style={{ width: `${(ch._count.id / recentReservations) * 100}%` }}
                    />
                  </div>
                  <span className="text-sm text-muted-foreground w-16 text-right">
                    {ch._count.id}件
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Sync status */}
      <Card>
        <CardHeader><CardTitle className="text-base">同期ステータス</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">処理待ちイベント</span>
              <div className="text-lg font-bold">{pendingEvents}</div>
            </div>
            <div>
              <span className="text-muted-foreground">失敗イベント (DLQ)</span>
              <div className={`text-lg font-bold ${failedEvents > 0 ? "text-destructive" : ""}`}>
                {failedEvents}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function KPICard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <Card>
      <CardContent className="p-4 text-center">
        <div className="text-2xl font-bold">{value}</div>
        <div className="text-xs text-muted-foreground mt-1">{label}</div>
        {sub && <div className="text-xs text-muted-foreground">{sub}</div>}
      </CardContent>
    </Card>
  );
}
