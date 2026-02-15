import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { format } from "date-fns";
import { fetchTodayReservations, fetchDashboardStats } from "../api";
import { TagBadge } from "../components/TagBadge";
import { AlertList } from "../components/AlertBadge";

export function TodayReservations() {
  const { data: reservations, isLoading } = useQuery({
    queryKey: ["reservations", "today"],
    queryFn: () => fetchTodayReservations(),
    refetchInterval: 60_000,
  });

  const { data: stats } = useQuery({
    queryKey: ["dashboard", "stats"],
    queryFn: fetchDashboardStats,
  });

  return (
    <div>
      {/* Stats chips */}
      {stats?.data && (
        <div className="stats-scroll">
          <div className="stat-chip">
            <div className="stat-chip-value">{stats.data.todayReservations}</div>
            <div className="stat-chip-label">本日予約</div>
          </div>
          <div className="stat-chip">
            <div className="stat-chip-value">{stats.data.vipCount}</div>
            <div className="stat-chip-label">VIP</div>
          </div>
          <div className="stat-chip">
            <div className="stat-chip-value">{stats.data.totalCustomers}</div>
            <div className="stat-chip-label">総顧客</div>
          </div>
          <div className="stat-chip">
            <div className="stat-chip-value">{stats.data.pendingDuplicates}</div>
            <div className="stat-chip-label">重複候補</div>
          </div>
          <div className="stat-chip">
            <div className="stat-chip-value">{stats.data.recentNoShows}</div>
            <div className="stat-chip-label">ノーショー</div>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="loading">読み込み中...</div>
      ) : !reservations?.data.length ? (
        <div className="empty-state"><p>本日の予約はありません</p></div>
      ) : (
        <div>
          {reservations.data.map((r) => (
            <Link to={`/reservations/${r.id}`} className="list-card" key={r.id}>
              <div className="list-card-header">
                <span className="list-card-title">
                  {format(new Date(r.dateTime), "HH:mm")}
                  <span style={{ fontWeight: 400, marginLeft: 8 }}>
                    {r.customer ? `${r.customer.lastName} ${r.customer.firstName}` : "--"}
                  </span>
                </span>
                <span className={`status-badge status-${r.status.toLowerCase()}`}>
                  {statusLabel(r.status)}
                </span>
              </div>

              <div className="list-card-meta">
                <span>{r.partySize}名</span>
                <span>{r.courseName || "--"}</span>
                <span>{r.tableLabel || "--"}</span>
                {r.customer?.companyName && <span>{r.customer.companyName}</span>}
              </div>

              {r.customer?.tags && r.customer.tags.length > 0 && (
                <div className="list-card-tags">
                  {r.customer.tags.map((t) => (
                    <TagBadge key={t.id} tag={t} />
                  ))}
                </div>
              )}

              {r.alerts.length > 0 && (
                <div style={{ marginTop: 6 }}>
                  <AlertList alerts={r.alerts} />
                </div>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function statusLabel(status: string): string {
  const map: Record<string, string> = {
    CONFIRMED: "確定",
    SEATED: "着席",
    COMPLETED: "完了",
    CANCELLED: "取消",
    NO_SHOW: "NS",
  };
  return map[status] || status;
}
