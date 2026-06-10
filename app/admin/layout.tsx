import type { ReactNode } from "react";
import { AdminLayout } from "@/components/layouts/AdminLayout";
import { requireAdminSession } from "@/lib/serverAuth";

interface AdminSectionLayoutProps {
  children: ReactNode;
}

/**
 * /admin/* 配下の共通レイアウト。
 *
 * route group 側 (app/(admin)/layout.tsx) と同様に、ミドルウェアに加えて
 * サーバーサイドでもセッションを検証する (多層防衛)。
 * AdminLayout により全管理画面に共通ナビゲーションを表示する。
 */
export default async function AdminSectionLayout({ children }: AdminSectionLayoutProps) {
  await requireAdminSession();
  return <AdminLayout>{children}</AdminLayout>;
}
