import { Outlet, NavLink, useLocation } from "react-router-dom";

const navItems = [
  { to: "/reservations/today", label: "予約", icon: "📋" },
  { to: "/customers", label: "顧客", icon: "👤" },
  { to: "/duplicates", label: "重複", icon: "🔀" },
  { to: "/tags", label: "タグ", icon: "🏷" },
  { to: "/sync", label: "同期", icon: "🔄" },
];

export function Layout({ staffName, onLogout }: { staffName: string; onLogout: () => void }) {
  const location = useLocation();

  // ページタイトル
  const pageTitle = (() => {
    if (location.pathname.startsWith("/reservations/today")) return "当日予約";
    if (location.pathname.startsWith("/reservations/")) return "予約詳細";
    if (location.pathname.startsWith("/customers/") && location.pathname !== "/customers") return "顧客詳細";
    if (location.pathname === "/customers") return "顧客検索";
    if (location.pathname === "/duplicates") return "重複統合";
    if (location.pathname === "/tags") return "タグ管理";
    if (location.pathname === "/sync") return "同期状態";
    return "TableCheck";
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
