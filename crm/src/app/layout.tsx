import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "TableCheck CRM",
  description: "顧客管理サブCRM",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja">
      <body className="min-h-screen bg-background font-sans antialiased">
        {children}
      </body>
    </html>
  );
}
