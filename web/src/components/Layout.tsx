import { Outlet, NavLink } from "react-router-dom";
import clsx from "clsx";

const navItems = [
  { to: "/reservations/today", label: "当日予約" },
  { to: "/customers", label: "顧客検索" },
  { to: "/duplicates", label: "重複統合" },
  { to: "/tags", label: "タグ管理" },
];

export function Layout() {
  return (
    <div className="app-layout">
      <aside className="sidebar">
        <div className="sidebar-logo">TableCheck CRM</div>
        <nav className="sidebar-nav">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                clsx("sidebar-link", isActive && "active")
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </aside>
      <main className="main-content">
        <Outlet />
      </main>
    </div>
  );
}
