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
      <div style={{ marginBottom: 12 }}>
        <button
          className="btn btn-primary btn-full"
          onClick={() => backfill.mutate()}
          disabled={backfill.isPending}
        >
          {backfill.isPending ? "実行中..." : "バックフィル実行"}
        </button>
      </div>

      {backfill.isSuccess && (
        <div className="card" style={{ padding: 12, marginBottom: 8, background: "#e8f5e9" }}>
          <p style={{ fontSize: 12, color: "#2e7d32" }}>バックフィルを開始しました</p>
        </div>
      )}

      {backfill.isError && (
        <div className="card" style={{ padding: 12, marginBottom: 8, background: "#fef2f2" }}>
          <p style={{ fontSize: 12, color: "#c62828" }}>失敗: {(backfill.error as Error).message}</p>
        </div>
      )}

      {isLoading ? (
        <div className="loading">読み込み中...</div>
      ) : !data?.data?.length ? (
        <div className="empty-state"><p>同期データがありません</p></div>
      ) : (
        <div className="card">
          {data.data.map((s: SyncState, i: number) => (
            <div key={s.id} className="info-row" style={{ borderBottom: i < data.data.length - 1 ? undefined : "none", alignItems: "flex-start", padding: "10px 12px" }}>
              <div style={{ minWidth: 50 }}>
                <div style={{ fontWeight: 600, fontSize: 13 }}>{entityLabel(s.objectType)}</div>
                <span className={`sync-status sync-status-${s.status.toLowerCase()}`}>
                  {statusLabel(s.status)}
                </span>
              </div>
              <div style={{ flex: 1, textAlign: "right" }}>
                <div style={{ fontSize: 13 }}>{s.recordsSynced.toLocaleString()}件</div>
                <div style={{ fontSize: 11, color: "var(--color-text-muted)" }}>
                  {s.lastSyncAt ? format(new Date(s.lastSyncAt), "M/d HH:mm") : "--"}
                </div>
                {s.errorMessage && (
                  <div style={{ fontSize: 11, color: "var(--color-danger)" }}>{s.errorMessage}</div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

interface SyncState {
  id: string;
  objectType: string;
  status: string;
  lastSyncAt: string | null;
  lastCursor: string | null;
  errorMessage: string | null;
  recordsSynced: number;
}

function entityLabel(type: string): string {
  return { customer: "顧客", reservation: "予約", shop: "店舗" }[type] || type;
}

function statusLabel(status: string): string {
  return { idle: "待機中", running: "実行中", completed: "完了", error: "エラー" }[status] || status;
}
