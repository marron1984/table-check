import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { fetchDuplicates, mergeDuplicate, rejectDuplicate, type Customer } from "../api";
import { TagBadge } from "../components/TagBadge";

export function DuplicateQueue() {
  const [page, setPage] = useState(1);
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["duplicates", page],
    queryFn: () => fetchDuplicates(page),
  });

  const mergeMutation = useMutation({
    mutationFn: mergeDuplicate,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["duplicates"] }),
  });

  const rejectMutation = useMutation({
    mutationFn: rejectDuplicate,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["duplicates"] }),
  });

  return (
    <div>
      <h1 className="page-title">重複統合キュー</h1>
      <p style={{ fontSize: 13, color: "var(--color-text-muted)", marginBottom: 16 }}>
        確信度スコアが高い順に表示。統合 or 却下で処理してください。
      </p>

      {isLoading && <div className="loading">読み込み中...</div>}

      {data && !data.data.length && (
        <div className="empty-state">
          <p>保留中の重複候補はありません</p>
        </div>
      )}

      {data?.data.map((dup) => (
        <div key={dup.id} className="card" style={{ marginBottom: 12 }}>
          <div style={{ padding: "8px 16px", fontSize: 12, color: "var(--color-text-muted)", borderBottom: "1px solid var(--color-border)" }}>
            確信度: <strong>{Math.round(dup.confidenceScore * 100)}%</strong>
            {" | "}
            一致項目: {(() => { try { return JSON.parse(dup.matchReasons).join(", "); } catch { return dup.matchReasons; } })()}
          </div>

          <div className="duplicate-pair">
            <CustomerCard customer={dup.primary} label="プライマリ" />
            <div className="duplicate-vs">VS</div>
            <CustomerCard customer={dup.secondary} label="セカンダリ" />
          </div>

          <div className="duplicate-actions">
            <button
              className="btn btn-primary btn-sm"
              disabled={mergeMutation.isPending}
              onClick={() => mergeMutation.mutate(dup.id)}
            >
              統合する
            </button>
            <button
              className="btn btn-outline btn-sm"
              disabled={rejectMutation.isPending}
              onClick={() => rejectMutation.mutate(dup.id)}
            >
              却下
            </button>
          </div>
        </div>
      ))}

      {data && data.pagination.totalPages > 1 && (
        <div style={{ marginTop: 12, display: "flex", gap: 8, justifyContent: "center" }}>
          <button className="btn btn-outline btn-sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>前へ</button>
          <span style={{ fontSize: 13, lineHeight: "32px" }}>{page} / {data.pagination.totalPages}</span>
          <button className="btn btn-outline btn-sm" disabled={page >= data.pagination.totalPages} onClick={() => setPage((p) => p + 1)}>次へ</button>
        </div>
      )}
    </div>
  );
}

function CustomerCard({ customer, label }: { customer: Customer; label: string }) {
  return (
    <div>
      <div style={{ fontSize: 11, color: "var(--color-text-muted)", marginBottom: 4 }}>{label}</div>
      <div style={{ fontWeight: 600, marginBottom: 4 }}>
        <Link to={`/customers/${customer.id}`}>
          {customer.lastName} {customer.firstName}
        </Link>
      </div>
      <div style={{ fontSize: 13, color: "var(--color-text-muted)" }}>{customer.phone || "--"}</div>
      <div style={{ fontSize: 13, color: "var(--color-text-muted)" }}>{customer.email || "--"}</div>
      <div style={{ marginTop: 4 }}>
        {customer.tags?.map((t) => (
          <TagBadge key={t.id} tag={{ id: t.id, assignedBy: null, tagDefinition: t.tagDefinition }} />
        ))}
      </div>
    </div>
  );
}
