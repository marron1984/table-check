import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { searchCustomers } from "../api";
import { TagBadge } from "../components/TagBadge";

export function CustomerSearch() {
  const [query, setQuery] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ["customers", "search", searchTerm, page],
    queryFn: () => searchCustomers(searchTerm, undefined, page),
    enabled: searchTerm.length > 0,
  });

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setSearchTerm(query);
    setPage(1);
  }

  return (
    <div>
      <h1 className="page-title">顧客検索</h1>

      <form onSubmit={handleSearch} style={{ marginBottom: 20, display: "flex", gap: 8 }}>
        <input
          type="text"
          className="search-input"
          placeholder="電話番号・名前・メール・企業名で検索..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <button type="submit" className="btn btn-primary">検索</button>
      </form>

      {isLoading && <div className="loading">検索中...</div>}

      {data && !data.data.length && (
        <div className="empty-state">
          <p>該当する顧客が見つかりません</p>
        </div>
      )}

      {data && data.data.length > 0 && (
        <>
          <div className="card">
            <table className="data-table">
              <thead>
                <tr>
                  <th>氏名</th>
                  <th>かな</th>
                  <th>電話</th>
                  <th>メール</th>
                  <th>企業</th>
                  <th>タグ</th>
                  <th>予約数</th>
                </tr>
              </thead>
              <tbody>
                {data.data.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <Link to={`/customers/${c.id}`} style={{ fontWeight: 600 }}>
                        {c.lastName} {c.firstName}
                      </Link>
                    </td>
                    <td style={{ fontSize: 13, color: "var(--color-text-muted)" }}>
                      {c.lastNameKana} {c.firstNameKana}
                    </td>
                    <td style={{ fontSize: 13 }}>{c.phone || "--"}</td>
                    <td style={{ fontSize: 13 }}>{c.email || "--"}</td>
                    <td style={{ fontSize: 13 }}>{c.companyName || "--"}</td>
                    <td>
                      {c.tags?.map((t) => <TagBadge key={t.id} tag={t} />)}
                    </td>
                    <td>{c._count?.reservations ?? "--"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {data.pagination.totalPages > 1 && (
            <div style={{ marginTop: 12, display: "flex", gap: 8, justifyContent: "center" }}>
              <button
                className="btn btn-outline btn-sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                前へ
              </button>
              <span style={{ fontSize: 13, lineHeight: "32px" }}>
                {page} / {data.pagination.totalPages}
              </span>
              <button
                className="btn btn-outline btn-sm"
                disabled={page >= data.pagination.totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                次へ
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
