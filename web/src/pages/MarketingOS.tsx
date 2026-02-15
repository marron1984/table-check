/**
 * dhpGマーケティングOS ダッシュボード
 * カスタマーブック・ミクロ計量分析を統合する上位概念ページ
 */
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { fetchDashboardStats } from "../api";

const modules = [
  {
    id: "customer-book",
    title: "カスタマーブック",
    desc: "顧客台帳・予約管理・タグ・重複統合",
    icon: "📖",
    color: "#0066ff",
    links: [
      { to: "/reservations/today", label: "当日予約" },
      { to: "/customers", label: "顧客検索" },
      { to: "/duplicates", label: "重複統合" },
      { to: "/tags", label: "タグ管理" },
      { to: "/sync", label: "同期状態" },
    ],
  },
  {
    id: "econometrics",
    title: "ミクロ計量分析",
    desc: "OLS回帰・LTV予測・Whiteロバスト標準誤差",
    icon: "📈",
    color: "#7c3aed",
    links: [
      { to: "/analytics", label: "計量分析ダッシュボード" },
    ],
  },
];

export function MarketingOS() {
  const { data: stats } = useQuery({
    queryKey: ["dashboard"],
    queryFn: fetchDashboardStats,
  });
  const d = stats?.data;

  return (
    <div>
      {/* Hero */}
      <div className="card" style={{ textAlign: "center", padding: "20px 16px 16px" }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: "#7c3aed", letterSpacing: 1, marginBottom: 4 }}>
          dhpG MARKETING OS
        </div>
        <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 2 }}>マーケティングOS</div>
        <div style={{ fontSize: 12, color: "var(--color-text-muted)" }}>
          データ駆動の顧客戦略基盤
        </div>
      </div>

      {/* KPI chips */}
      {d && (
        <div className="stats-scroll" style={{ margin: "10px 0" }}>
          <div className="stat-chip">
            <div className="stat-chip-value">{d.todayReservations}</div>
            <div className="stat-chip-label">本日予約</div>
          </div>
          <div className="stat-chip">
            <div className="stat-chip-value">{d.vipCount}</div>
            <div className="stat-chip-label">VIP顧客</div>
          </div>
          <div className="stat-chip">
            <div className="stat-chip-value">{d.totalCustomers.toLocaleString()}</div>
            <div className="stat-chip-label">総顧客数</div>
          </div>
          <div className="stat-chip">
            <div className="stat-chip-value">{d.duplicateRate}%</div>
            <div className="stat-chip-label">重複率</div>
          </div>
        </div>
      )}

      {/* Module cards */}
      {modules.map((mod) => (
        <div key={mod.id} className="card" style={{ marginTop: 10 }}>
          <div style={{ padding: "14px 14px 10px", display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 28 }}>{mod.icon}</span>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700 }}>{mod.title}</div>
              <div style={{ fontSize: 11, color: "var(--color-text-muted)" }}>{mod.desc}</div>
            </div>
          </div>
          <div style={{
            display: "flex", flexWrap: "wrap", gap: 6,
            padding: "0 14px 14px",
          }}>
            {mod.links.map((l) => (
              <Link
                key={l.to}
                to={l.to}
                style={{
                  display: "inline-block",
                  padding: "6px 14px",
                  background: mod.color + "10",
                  color: mod.color,
                  borderRadius: 8,
                  fontSize: 12,
                  fontWeight: 600,
                }}
              >
                {l.label}
              </Link>
            ))}
          </div>
        </div>
      ))}

      {/* Methodology note */}
      <div className="card" style={{ marginTop: 10 }}>
        <div className="section-title">分析基盤</div>
        <div style={{ padding: "4px 14px 14px", fontSize: 12, color: "var(--color-text-muted)", lineHeight: 1.7 }}>
          BG/NBDモデル・Gamma-Gammaモデルによる予測LTV、
          OLS回帰とWhiteのロバスト標準誤差による統計的推測、
          RFMセグメンテーションを統合した計量経済学的顧客分析。
        </div>
      </div>
    </div>
  );
}
