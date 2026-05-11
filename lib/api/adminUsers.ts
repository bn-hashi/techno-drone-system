import { CourseType, UserStatus } from "@/types/prisma";

export interface CreateUserInput {
  email: string;
  name: string;
  password: string;
  courseType: CourseType;
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
