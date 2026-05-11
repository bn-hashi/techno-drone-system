import type { ReactNode } from "react";
import { AppLayout } from "@/components/layouts/AppLayout";

// 管理者向けナビゲーションリンク定義
const NAVIGATION_LINKS = [
  { href: "/admin/students", label: "受講者一覧" },
  { href: "/admin/applications", label: "入学申請" },
] as const;

interface AdminLayoutProps {
  children: ReactNode;
}

export function AdminLayout({ children }: AdminLayoutProps) {
  return (
    <AppLayout navLabel="管理者メニュー" links={NAVIGATION_LINKS}>
      {children}
    </AppLayout>
  );
}
