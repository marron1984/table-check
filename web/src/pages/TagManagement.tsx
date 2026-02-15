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
    if (!acc[t.category]) acc[t.category] = [];
    acc[t.category].push(t);
    return acc;
  }, {});

  return (
    <div>
      <p style={{ fontSize: 12, color: "var(--color-text-muted)", marginBottom: 12 }}>
        自動付与タグの定義と付与状況
      </p>

      {Object.entries(grouped).map(([category, catTags]) => (
        <div key={category} style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "var(--color-text-muted)", marginBottom: 4 }}>
            {categories[category] || category}
          </div>
          <div className="card">
            {catTags.map((t, i) => (
              <div key={t.id} className="info-row" style={{ borderBottom: i < catTags.length - 1 ? undefined : "none" }}>
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
                <span style={{ flex: 1, fontSize: 11, fontFamily: "monospace", color: "var(--color-text-muted)" }}>
                  {t.slug}
                </span>
                <span style={{ fontSize: 12, color: "var(--color-text-muted)" }}>
                  {t._count?.customerTags ?? 0}件
                </span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
