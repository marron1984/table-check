import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

export default async function TodayPage() {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);

  const reservations = await prisma.reservation.findMany({
    where: {
      startsAt: { gte: todayStart, lt: todayEnd },
      deletedAt: null,
      status: { not: "cancelled" },
    },
    include: {
      customer: {
        include: { tags: { include: { tag: true } } },
      },
      store: true,
    },
    orderBy: { startsAt: "asc" },
  });

  const totalGuests = reservations.reduce((sum, r) => sum + r.partySize, 0);
  const vipCount = reservations.filter((r) => {
    const flags = JSON.parse(r.flags || "{}");
    return flags.vip;
  }).length;
  const alertCount = reservations.filter((r) => {
    const flags = JSON.parse(r.flags || "{}");
    return flags.severeAllergy || flags.noShowRisk;
  }).length;

  return (
    <div>
      <h1 className="text-xl font-bold mb-4">本日の予約</h1>

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <StatCard label="予約数" value={String(reservations.length)} />
        <StatCard label="総ゲスト" value={String(totalGuests)} />
        <StatCard label="VIP" value={String(vipCount)} highlight />
        <StatCard label="要注意" value={String(alertCount)} warning={alertCount > 0} />
      </div>

      {/* Reservation list */}
      <div className="space-y-3">
        {reservations.length === 0 && (
          <p className="text-center text-muted-foreground py-12">本日の予約はありません</p>
        )}
        {reservations.map((r) => {
          const flags = JSON.parse(r.flags || "{}");
          const time = new Date(r.startsAt).toLocaleTimeString("ja-JP", {
            hour: "2-digit",
            minute: "2-digit",
          });

          return (
            <Card key={r.id}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-lg font-bold">{time}</span>
                      <span className="text-sm text-muted-foreground">
                        {r.partySize}名
                      </span>
                      {r.courseName && (
                        <span className="text-xs text-muted-foreground truncate">
                          {r.courseName}
                        </span>
                      )}
                    </div>
                    <a
                      href={`/customers/${r.customerId}`}
                      className="text-sm font-semibold hover:text-primary transition-colors"
                    >
                      {r.customer.displayName}
                      {r.customer.kanaName && (
                        <span className="text-xs text-muted-foreground ml-1">
                          ({r.customer.kanaName})
                        </span>
                      )}
                    </a>
                    <div className="flex flex-wrap gap-1 mt-2">
                      {flags.vip && <Badge variant="success">VIP</Badge>}
                      {flags.severeAllergy && <Badge variant="destructive">重大アレルギー</Badge>}
                      {flags.noShowRisk && <Badge variant="warning">ノーショー注意</Badge>}
                      {flags.anniversary && <Badge>記念日</Badge>}
                      {r.customer.allergySeverity === "severe" && !flags.severeAllergy && (
                        <Badge variant="destructive">アレルギー</Badge>
                      )}
                      {r.customer.tags?.map((ct) => (
                        <Badge key={ct.tagId} variant="outline">
                          {ct.tag.label}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <div className="text-right text-xs text-muted-foreground shrink-0">
                    <div>{r.store.name}</div>
                    {r.tableInfo && <div>{r.tableInfo}</div>}
                    <div className="mt-1">
                      来店{r.customer.visitsCount}回
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function StatCard({ label, value, highlight, warning }: {
  label: string; value: string; highlight?: boolean; warning?: boolean;
}) {
  return (
    <Card>
      <CardContent className="p-4 text-center">
        <div className={`text-2xl font-bold ${warning ? "text-destructive" : highlight ? "text-primary" : ""}`}>
          {value}
        </div>
        <div className="text-xs text-muted-foreground mt-1">{label}</div>
      </CardContent>
    </Card>
  );
}
