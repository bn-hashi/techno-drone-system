import type { ReactNode } from "react";
import { AppLayout } from "@/components/layouts/AppLayout";

// 受講生向けナビゲーションリンク定義
const NAVIGATION_LINKS = [
  { href: "/student/dashboard", label: "ダッシュボード" },
  { href: "/student/courses", label: "受講" },
  { href: "/student/exams", label: "試験" },
  { href: "/qa", label: "質疑応答" },
  { href: "/certificate", label: "修了証明書" },
] as const;

interface StudentLayoutProps {
  children: ReactNode;
}

export function StudentLayout({ children }: StudentLayoutProps) {
  return (
    <AppLayout navLabel="受講者メニュー" links={NAVIGATION_LINKS}>
      {children}
    </AppLayout>
  );
}
