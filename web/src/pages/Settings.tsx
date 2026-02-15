/**
 * 管理メニュー - 重複統合・タグ管理・同期状態へのハブ
 */
import { Link } from "react-router-dom";

const items = [
  { to: "/duplicates", icon: "🔀", label: "重複統合", desc: "顧客の重複候補を確認・統合" },
  { to: "/tags", icon: "🏷", label: "タグ管理", desc: "顧客タグの一覧と管理" },
  { to: "/sync", icon: "🔄", label: "同期状態", desc: "TableCheck APIとの同期ステータス" },
];

export function Settings() {
  return (
    <div>
      {items.map((item) => (
        <Link key={item.to} to={item.to} className="list-card" style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 28 }}>{item.icon}</span>
          <div>
            <div style={{ fontSize: 15, fontWeight: 600 }}>{item.label}</div>
            <div style={{ fontSize: 12, color: "var(--color-text-muted)" }}>{item.desc}</div>
          </div>
        </Link>
      ))}
    </div>
  );
}
