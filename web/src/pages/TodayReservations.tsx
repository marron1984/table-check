import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { format } from "date-fns";
import { ja } from "date-fns/locale";
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

  const today = format(new Date(), "M月d日(E)", { locale: ja });

  return (
    <div>
      <h1 className="page-title">{today} の予約一覧</h1>

      {stats?.data && (
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-value">{stats.data.todayReservations}</div>
            <div className="stat-label">本日の予約</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{stats.data.vipCount}</div>
            <div className="stat-label">VIP顧客</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{stats.data.totalCustomers}</div>
            <div className="stat-label">総顧客数</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{stats.data.avgProfileCompleteness}%</div>
            <div className="stat-label">プロファイル充足率</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{stats.data.pendingDuplicates}</div>
            <div className="stat-label">重複候補</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{stats.data.recentNoShows}</div>
            <div className="stat-label">直近ノーショー</div>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="loading">読み込み中...</div>
      ) : !reservations?.data.length ? (
        <div className="empty-state">
          <p>本日の予約はありません</p>
        </div>
      ) : (
        <div className="card">
          <table className="data-table">
            <thead>
              <tr>
                <th>時間</th>
                <th>顧客名</th>
                <th>人数</th>
                <th>コース</th>
                <th>席</th>
                <th>タグ</th>
                <th>アラート</th>
                <th>状態</th>
              </tr>
            </thead>
            <tbody>
              {reservations.data.map((r) => (
                <tr key={r.id}>
                  <td>
                    <Link to={`/reservations/${r.id}`} style={{ fontWeight: 600 }}>
                      {format(new Date(r.dateTime), "HH:mm")}
                    </Link>
                  </td>
                  <td>
                    {r.customer ? (
                      <Link to={`/customers/${r.customer.id}`}>
                        {r.customer.lastName} {r.customer.firstName}
                        {r.customer.companyName && (
                          <span style={{ color: "var(--color-text-muted)", fontSize: 12, marginLeft: 4 }}>
                            ({r.customer.companyName})
                          </span>
                        )}
                      </Link>
                    ) : (
                      <span style={{ color: "var(--color-text-muted)" }}>--</span>
                    )}
                  </td>
                  <td>{r.partySize}名</td>
                  <td>{r.courseName || "--"}</td>
                  <td>{r.tableLabel || "--"}</td>
                  <td>
                    {r.customer?.tags?.map((t) => (
                      <TagBadge key={t.id} tag={t} />
                    ))}
                  </td>
                  <td>
                    <AlertList alerts={r.alerts} />
                  </td>
                  <td>
                    <span style={{
                      fontSize: 12,
                      fontWeight: 600,
                      color: r.status === "CONFIRMED" ? "var(--color-primary)" :
                             r.status === "SEATED" ? "var(--color-success)" :
                             "var(--color-text-muted)",
                    }}>
                      {statusLabel(r.status)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
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
    CANCELLED: "キャンセル",
    NO_SHOW: "ノーショー",
  };
  return map[status] || status;
}
