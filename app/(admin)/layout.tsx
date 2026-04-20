import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { authOptions } from "@/lib/auth";
import { AdminLayout } from "@/components/layouts/AdminLayout";

interface AdminRootLayoutProps {
  children: ReactNode;
}

// ミドルウェアに加えてサーバーサイドでもセッションを検証する（多層防衛）
export default async function AdminRootLayout({ children }: AdminRootLayoutProps) {
  const session = await getServerSession(authOptions);

  if (!session?.user || session.user.role !== "ADMIN") {
    redirect("/login");
  }

  return <AdminLayout>{children}</AdminLayout>;
}
