import { useQuery } from "@tanstack/react-query";
import { fetchTags } from "../api";

export function TagManagement() {
  const { data, isLoading } = useQuery({
    queryKey: ["tags"],
    queryFn: fetchTags,
  });

  const categories: Record<string, string> = {
    engagement: "エンゲージメント",
    risk: "リスク",
    preference: "嗜好",
    attribute: "属性",
  };

  if (isLoading) return <div className="loading">読み込み中...</div>;

  const tags = data?.data || [];
  const grouped = tags.reduce<Record<string, typeof tags>>((acc, t) => {
    const cat = t.category;
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(t);
    return acc;
  }, {});

  return (
    <div>
      <h1 className="page-title">タグ管理</h1>
      <p style={{ fontSize: 13, color: "var(--color-text-muted)", marginBottom: 16 }}>
        自動付与タグの定義と付与状況。手動付与は顧客詳細画面から。
      </p>

      {Object.entries(grouped).map(([category, catTags]) => (
        <div key={category} style={{ marginBottom: 24 }}>
          <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>
            {categories[category] || category}
          </h2>
          <div className="card">
            <table className="data-table">
              <thead>
                <tr>
                  <th>タグ</th>
                  <th>スラッグ</th>
                  <th>色</th>
                  <th>優先度</th>
                  <th>付与数</th>
                </tr>
              </thead>
              <tbody>
                {catTags.map((t) => (
                  <tr key={t.id}>
                    <td>
                      <span
                        className="tag"
                        style={{
                          backgroundColor: `${t.color}15`,
                          color: t.color || "#6B7280",
                          border: `1px solid ${t.color}40`,
                        }}
                      >
                        {t.labelJa}
                      </span>
                    </td>
                    <td style={{ fontSize: 13, fontFamily: "monospace" }}>{t.slug}</td>
                    <td>
                      <span
                        style={{
                          display: "inline-block",
                          width: 16,
                          height: 16,
                          borderRadius: 4,
                          background: t.color || "#6B7280",
                          verticalAlign: "middle",
                        }}
                      />
                    </td>
                    <td>{t.priority}</td>
                    <td>{t._count?.customerTags ?? 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  );
}
