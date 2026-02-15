import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { fetchDuplicates, mergeDuplicate, rejectDuplicate } from "../api";
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
      <p style={{ fontSize: 12, color: "var(--color-text-muted)", marginBottom: 12 }}>
        確信度スコアが高い順に表示
      </p>

      {isLoading && <div className="loading">読み込み中...</div>}

      {data && !data.data.length && (
        <div className="empty-state"><p>保留中の重複候補はありません</p></div>
      )}

      {data?.data.map((dup) => (
        <div key={dup.id} className="dup-card">
          <div className="dup-header">
            確信度 <strong>{Math.round(dup.confidenceScore * 100)}%</strong>
            {" / "}
            {(() => { try { return JSON.parse(dup.matchReasons).join(", "); } catch { return dup.matchReasons; } })()}
          </div>

          <div className="dup-pair">
            <div className="dup-person">
              <div className="dup-person-label">プライマリ</div>
              <Link to={`/customers/${dup.primary.id}`} className="dup-person-name">
                {dup.primary.lastName} {dup.primary.firstName}
              </Link>
              <div className="dup-person-info">{dup.primary.phone || "--"}</div>
              <div style={{ marginTop: 4, display: "flex", flexWrap: "wrap", gap: 3 }}>
                {dup.primary.tags?.map((t) => (
                  <TagBadge key={t.id} tag={{ id: t.id, assignedBy: null, tagDefinition: t.tagDefinition }} />
                ))}
              </div>
            </div>
            <div className="dup-person">
              <div className="dup-person-label">セカンダリ</div>
              <Link to={`/customers/${dup.secondary.id}`} className="dup-person-name">
                {dup.secondary.lastName} {dup.secondary.firstName}
              </Link>
              <div className="dup-person-info">{dup.secondary.phone || "--"}</div>
              <div style={{ marginTop: 4, display: "flex", flexWrap: "wrap", gap: 3 }}>
                {dup.secondary.tags?.map((t) => (
                  <TagBadge key={t.id} tag={{ id: t.id, assignedBy: null, tagDefinition: t.tagDefinition }} />
                ))}
              </div>
            </div>
          </div>

          <div className="dup-actions">
            <button className="btn btn-primary btn-sm" disabled={mergeMutation.isPending} onClick={() => mergeMutation.mutate(dup.id)}>統合</button>
            <button className="btn btn-outline btn-sm" disabled={rejectMutation.isPending} onClick={() => rejectMutation.mutate(dup.id)}>却下</button>
          </div>
        </div>
      ))}

      {data && data.pagination.totalPages > 1 && (
        <div className="pagination">
          <button className="btn btn-outline btn-sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>前</button>
          <span>{page} / {data.pagination.totalPages}</span>
          <button className="btn btn-outline btn-sm" disabled={page >= data.pagination.totalPages} onClick={() => setPage((p) => p + 1)}>次</button>
        </div>
      )}
    </div>
  );
}
