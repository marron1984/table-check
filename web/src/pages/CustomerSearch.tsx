import { useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { searchCustomers, type Customer } from "../api";
import { TagBadge } from "../components/TagBadge";

export function CustomerSearch() {
  const [query, setQuery] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [page, setPage] = useState(1);
  const [exporting, setExporting] = useState(false);

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

  const handleExport = useCallback(async () => {
    if (!searchTerm) return;
    setExporting(true);
    try {
      const result = await searchCustomers(searchTerm, undefined, 1);
      downloadCSV(result.data, `customers_${searchTerm}`);
    } finally {
      setExporting(false);
    }
  }, [searchTerm]);

  return (
    <div>
      <form onSubmit={handleSearch} className="search-bar">
        <input
          type="text"
          className="search-input"
          placeholder="名前・電話・企業..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <button type="submit" className="btn btn-primary">検索</button>
      </form>

      {isLoading && <div className="loading">検索中...</div>}

      {data && !data.data.length && (
        <div className="empty-state"><p>該当なし</p></div>
      )}

      {data && data.data.length > 0 && (
        <>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <span style={{ fontSize: 12, color: "var(--color-text-muted)" }}>
              {data.pagination.total}件
            </span>
            <button type="button" className="btn btn-outline btn-sm" onClick={handleExport} disabled={exporting}>
              {exporting ? "..." : "CSV"}
            </button>
          </div>

          {data.data.map((c) => (
            <Link to={`/customers/${c.id}`} className="list-card" key={c.id}>
              <div className="list-card-header">
                <span className="list-card-title">
                  {c.lastName} {c.firstName}
                </span>
                {c._count?.reservations != null && (
                  <span className="list-card-sub">{c._count.reservations}回</span>
                )}
              </div>
              <div className="list-card-meta">
                {c.lastNameKana && <span>{c.lastNameKana} {c.firstNameKana}</span>}
                {c.phone && <span>{c.phone}</span>}
                {c.companyName && <span>{c.companyName}</span>}
              </div>
              {c.tags && c.tags.length > 0 && (
                <div className="list-card-tags">
                  {c.tags.map((t) => <TagBadge key={t.id} tag={t} />)}
                </div>
              )}
            </Link>
          ))}

          {data.pagination.totalPages > 1 && (
            <div className="pagination">
              <button className="btn btn-outline btn-sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>前</button>
              <span>{page} / {data.pagination.totalPages}</span>
              <button className="btn btn-outline btn-sm" disabled={page >= data.pagination.totalPages} onClick={() => setPage((p) => p + 1)}>次</button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function downloadCSV(customers: Customer[], filename: string) {
  const BOM = "\uFEFF";
  const headers = ["氏名", "かな", "電話", "メール", "企業", "言語", "タグ", "予約数"];
  const rows = customers.map((c) => [
    `${c.lastName || ""} ${c.firstName || ""}`.trim(),
    `${c.lastNameKana || ""} ${c.firstNameKana || ""}`.trim(),
    c.phone || "",
    c.email || "",
    c.companyName || "",
    c.language || "",
    c.tags?.map((t) => t.tagDefinition.labelJa).join(" / ") || "",
    String(c._count?.reservations ?? ""),
  ]);

  const csvContent = BOM + [
    headers.join(","),
    ...rows.map((row) => row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(",")),
  ].join("\n");

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${filename}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
