import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { authOptions } from "@/lib/auth";
import { StudentLayout } from "@/components/layouts/StudentLayout";
import { UserRole, UserStatus } from "@/types/prisma";

interface StudentRootLayoutProps {
  children: ReactNode;
}

// ミドルウェアに加えてサーバーサイドでもセッションを検証する（多層防衛）
export default async function StudentRootLayout({ children }: StudentRootLayoutProps) {
  const session = await getServerSession(authOptions);

  if (
    !session?.user ||
    session.user.role !== UserRole.STUDENT ||
    session.user.status !== UserStatus.ACTIVE
  ) {
    redirect("/login");
  }

  return <StudentLayout>{children}</StudentLayout>;
}
