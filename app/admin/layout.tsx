import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { authOptions } from "@/lib/auth";
import { AdminLayout } from "@/components/layouts/AdminLayout";
import { UserRole } from "@/types/prisma";

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
  const session = await getServerSession(authOptions);

  if (!session?.user || session.user.role !== UserRole.ADMIN) {
    redirect("/login");
  }

  return <AdminLayout>{children}</AdminLayout>;
}
