import { CourseType, UserStatus } from "@/types/prisma";
import type { SafeUser } from "@/services/userManagementService";

export interface CreateUserInput {
  email: string;
  name: string;
  password: string;
  courseType: CourseType;
}

/**
 * Server Component 用: 内部 API を fetch して受講者一覧を取得する
 * cookie を転送して認証を維持する
 */
export async function fetchAdminUsers(baseUrl: string, cookie: string): Promise<SafeUser[]> {
  const response = await fetch(`${baseUrl}/api/admin/users`, {
    headers: { cookie },
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error("受講者一覧の取得に失敗しました");
  }
  const body = await response.json();
  return body.users;
}

export async function postCreateUser(input: CreateUserInput): Promise<void> {
  const response = await fetch("/api/admin/users", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    const body = await response.json();
    throw new Error(body.error ?? "登録に失敗しました");
  }
}

export async function patchUserStatus(userId: string, status: UserStatus): Promise<void> {
  const response = await fetch(`/api/admin/users/${userId}/status`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status }),
  });
  if (!response.ok) {
    const body = await response.json();
    throw new Error(body.error ?? "ステータス変更に失敗しました");
  }
}
