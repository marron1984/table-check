import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchSyncStatus, triggerBackfill } from "../api";
import { format } from "date-fns";

export function SyncStatus() {
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["syncStatus"],
    queryFn: fetchSyncStatus,
    refetchInterval: 10_000,
  });

  const backfill = useMutation({
    mutationFn: triggerBackfill,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["syncStatus"] });
    },
  });

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <h1 className="page-title" style={{ marginBottom: 0 }}>同期ステータス</h1>
        <button
          className="btn btn-primary"
          onClick={() => backfill.mutate()}
          disabled={backfill.isPending}
        >
          {backfill.isPending ? "実行中..." : "バックフィル実行"}
        </button>
      </div>

      {backfill.isSuccess && (
        <div className="card" style={{ marginBottom: 12, background: "#f0fdf4", borderColor: "#bbf7d0" }}>
          <p style={{ fontSize: 13, color: "#16a34a" }}>バックフィルを開始しました。処理完了まで数分かかる場合があります。</p>
        </div>
      )}

      {backfill.isError && (
        <div className="card" style={{ marginBottom: 12, background: "#fef2f2", borderColor: "#fecaca" }}>
          <p style={{ fontSize: 13, color: "#dc2626" }}>バックフィルの実行に失敗しました: {(backfill.error as Error).message}</p>
        </div>
      )}

      {isLoading ? (
        <div className="loading">読み込み中...</div>
      ) : !data?.data?.length ? (
        <div className="empty-state"><p>同期データがありません。バックフィルを実行してください。</p></div>
      ) : (
        <div className="card">
          <table className="data-table">
            <thead>
              <tr>
                <th>エンティティ</th>
                <th>ステータス</th>
                <th>最終同期</th>
                <th>カーソル</th>
                <th>エラー</th>
              </tr>
            </thead>
            <tbody>
              {data.data.map((s: SyncState) => (
                <tr key={s.id}>
                  <td style={{ fontWeight: 600 }}>{entityLabel(s.entityType)}</td>
                  <td>
                    <span className={`sync-status sync-status-${s.status.toLowerCase()}`}>
                      {statusLabel(s.status)}
                    </span>
                  </td>
                  <td style={{ fontSize: 13 }}>
                    {s.lastSyncAt ? format(new Date(s.lastSyncAt), "yyyy/MM/dd HH:mm:ss") : "--"}
                  </td>
                  <td style={{ fontSize: 12, fontFamily: "monospace", maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis" }}>
                    {s.cursor || "--"}
                  </td>
                  <td style={{ fontSize: 13, color: s.lastError ? "var(--color-danger)" : "var(--color-text-muted)" }}>
                    {s.lastError || "--"}
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

interface SyncState {
  id: string;
  entityType: string;
  status: string;
  lastSyncAt: string | null;
  cursor: string | null;
  lastError: string | null;
}

function entityLabel(type: string): string {
  const labels: Record<string, string> = {
    customer: "顧客",
    reservation: "予約",
    shop: "店舗",
  };
  return labels[type] || type;
}

function statusLabel(status: string): string {
  const labels: Record<string, string> = {
    IDLE: "待機中",
    RUNNING: "実行中",
    COMPLETED: "完了",
    FAILED: "エラー",
  };
  return labels[status] || status;
}
