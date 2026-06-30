import type { ReactNode } from "react";
import { AppLayout } from "@/components/layouts/AppLayout";

const NAVIGATION_LINKS = [
  { href: "/admin/users", label: "受講者管理" },
  { href: "/admin/applications", label: "入学申請" },
  { href: "/admin/courses", label: "コース管理" },
  { href: "/admin/videos", label: "動画管理" },
  { href: "/admin/questions", label: "問題バンク" },
  { href: "/admin/exam-results", label: "試験結果" },
  { href: "/admin/qa", label: "質疑応答" },
  { href: "/admin/fraud-flags", label: "不正フラグ" },
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
