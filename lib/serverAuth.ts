import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { UserRole } from "@/types/prisma";
import { hasFlightAccess } from "@/lib/auth/flightPermissions";

/**
 * 管理者セッションを検証し、未認証または非 ADMIN を /login へリダイレクトする。
 *
 * route group 側 (app/(admin)/layout.tsx) と通常ディレクトリ側 (app/admin/layout.tsx)
 * の両管理レイアウトで共有し、セッション検証ロジックの重複を防ぐ。
 * Server Component / Server Action 専用 (next/navigation の redirect を使用)。
 */
export async function requireAdminSession(): Promise<void> {
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.role !== UserRole.ADMIN) {
    redirect("/login");
  }
}

/**
 * ADMIN または PILOT ロールのセッションを検証し、
 * 未認証または対象外ロールは /login へリダイレクトする。
 * Server Component / Server Action 専用。
 */
export async function requireFlightSession(): Promise<{ userId: string; role: UserRole }> {
  const session = await getServerSession(authOptions);
  if (!session?.user || !hasFlightAccess(session.user.role as UserRole)) {
    redirect("/login");
  }
  return {
    userId: session!.user.id,
    role: session!.user.role as UserRole,
  };
}
