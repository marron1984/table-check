import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { Sidebar, MobileNav } from "@/components/sidebar";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }

  return (
    <div className="min-h-screen">
      <Sidebar />
      <div className="md:pl-56">
        <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="flex h-14 items-center justify-between px-4 md:px-6">
            <h2 className="text-sm font-semibold md:hidden">TableCheck CRM</h2>
            <div className="flex items-center gap-2 ml-auto">
              <span className="text-xs text-muted-foreground">{session.displayName}</span>
              <span className="text-xs bg-muted px-2 py-0.5 rounded">{session.role}</span>
            </div>
          </div>
        </header>
        <main className="p-4 md:p-6 pb-20 md:pb-6">{children}</main>
      </div>
      <MobileNav />
    </div>
  );
}
