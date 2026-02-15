import { Outlet, NavLink, useLocation } from "react-router-dom";

const navItems = [
  { to: "/", label: "OS", icon: "🏠", exact: true },
  { to: "/reservations/today", label: "予約", icon: "📋", exact: false },
  { to: "/customers", label: "顧客", icon: "👤", exact: false },
  { to: "/analytics", label: "計量", icon: "📈", exact: false },
  { to: "/settings", label: "管理", icon: "⚙", exact: false },
];

export function Layout({ staffName, onLogout }: { staffName: string; onLogout: () => void }) {
  const location = useLocation();

  // ページタイトル
  const pageTitle = (() => {
    if (location.pathname === "/") return "dhpGマーケティングOS";
    if (location.pathname.startsWith("/reservations/today")) return "当日予約";
    if (location.pathname.startsWith("/reservations/")) return "予約詳細";
    if (location.pathname.startsWith("/customers/") && location.pathname !== "/customers") return "顧客詳細";
    if (location.pathname === "/customers") return "顧客検索";
    if (location.pathname === "/analytics") return "ミクロ計量分析";
    if (location.pathname === "/duplicates") return "重複統合";
    if (location.pathname === "/tags") return "タグ管理";
    if (location.pathname === "/sync") return "同期状態";
    if (location.pathname === "/settings") return "管理";
    return "dhpGマーケティングOS";
  })();

  return (
    <div className="app-shell">
      {/* Top header */}
      <header className="top-bar">
        <div className="top-bar-title">{pageTitle}</div>
        <button className="top-bar-user" onClick={onLogout}>
          {staffName || "管理者"} <span className="top-bar-logout">▸</span>
        </button>
      </header>

      {/* Main content */}
      <main className="main-content">
        <Outlet />
      </main>

      {/* Bottom tab bar */}
      <nav className="bottom-nav">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.exact}
            className={({ isActive }) =>
              `bottom-nav-item${isActive ? " active" : ""}`
            }
          >
            <span className="bottom-nav-icon">{item.icon}</span>
            <span className="bottom-nav-label">{item.label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
