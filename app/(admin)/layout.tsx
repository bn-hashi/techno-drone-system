import type { ReactNode } from "react";
import { AdminLayout } from "@/components/layouts/AdminLayout";
import { requireAdminSession } from "@/lib/serverAuth";

interface AdminRootLayoutProps {
  children: ReactNode;
}

// ミドルウェアに加えてサーバーサイドでもセッションを検証する（多層防衛）
export default async function AdminRootLayout({ children }: AdminRootLayoutProps) {
  await requireAdminSession();
  return <AdminLayout>{children}</AdminLayout>;
}
