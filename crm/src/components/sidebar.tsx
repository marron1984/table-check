"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";

const NAV_ITEMS = [
  { href: "/dashboard/today", label: "本日の予約", icon: "📋" },
  { href: "/customers", label: "顧客管理", icon: "👤" },
  { href: "/merge-queue", label: "統合キュー", icon: "🔗" },
  { href: "/tags", label: "タグ管理", icon: "🏷️" },
  { href: "/reports/basic", label: "レポート", icon: "📊" },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden md:flex md:w-56 md:flex-col md:fixed md:inset-y-0 bg-card border-r">
      <div className="flex-1 flex flex-col pt-5 pb-4">
        <div className="px-4 mb-6">
          <h1 className="text-lg font-bold">TableCheck CRM</h1>
          <p className="text-xs text-muted-foreground">サブCRM管理画面</p>
        </div>
        <nav className="flex-1 px-2 space-y-1">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                pathname.startsWith(item.href)
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              <span>{item.icon}</span>
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
    </aside>
  );
}

export function MobileNav() {
  const pathname = usePathname();

  return (
    <nav className="md:hidden fixed bottom-0 inset-x-0 z-50 bg-card border-t flex">
      {NAV_ITEMS.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className={cn(
            "flex-1 flex flex-col items-center gap-0.5 py-2 text-xs",
            pathname.startsWith(item.href)
              ? "text-primary font-semibold"
              : "text-muted-foreground",
          )}
        >
          <span className="text-lg">{item.icon}</span>
          <span className="truncate">{item.label}</span>
        </Link>
      ))}
    </nav>
  );
}
