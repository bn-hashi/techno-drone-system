import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { authOptions } from "@/lib/auth";
import { StudentLayout } from "@/components/layouts/StudentLayout";
import { UserRole, UserStatus } from "@/types/prisma";

interface StudentRootLayoutProps {
  children: ReactNode;
}

// 受講者ルートグループ全体で許可するステータス
// 各ページ (/qa, /certificate など) の個別 allowlist は別途維持する
const ALLOWED_STATUSES: readonly UserStatus[] = [
  UserStatus.ACTIVE,
  UserStatus.EXAM_PASSED,
  UserStatus.COMPLETED,
  UserStatus.CERTIFIED,
  UserStatus.DIPS_LINKED,
];

// ミドルウェアに加えてサーバーサイドでもセッションを検証する（多層防衛）
export default async function StudentRootLayout({ children }: StudentRootLayoutProps) {
  const session = await getServerSession(authOptions);

  if (
    !session?.user ||
    session.user.role !== UserRole.STUDENT ||
    !ALLOWED_STATUSES.includes(session.user.status)
  ) {
    redirect("/login");
  }

  return <StudentLayout>{children}</StudentLayout>;
}
