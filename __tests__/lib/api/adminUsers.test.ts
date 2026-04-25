import { describe, it, expect, vi, beforeEach } from "vitest";
import { postCreateUser, patchUserStatus } from "@/lib/api/adminUsers";
import { CourseType, UserStatus } from "@/types/prisma";

describe("postCreateUser", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("should send POST request with correct body", async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: true });
    global.fetch = mockFetch;

    const input = {
      email: "test@example.com",
      name: "Test User",
      password: "password123",
      courseType: CourseType.BEGINNER,
    };

    await postCreateUser(input);

    expect(mockFetch).toHaveBeenCalledWith("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
  });

  it("should throw error with server message when response is not ok", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({ error: "メールアドレスが重複しています" }),
    });

    await expect(
      postCreateUser({
        email: "dup@example.com",
        name: "Dup User",
        password: "password123",
        courseType: CourseType.BEGINNER,
      })
    ).rejects.toThrow("メールアドレスが重複しています");
  });

  it("should throw default error message when server returns no error field", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({}),
    });

    await expect(
      postCreateUser({
        email: "test@example.com",
        name: "Test User",
        password: "password123",
        courseType: CourseType.BEGINNER,
      })
    ).rejects.toThrow("登録に失敗しました");
  });
});

describe("patchUserStatus", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("should send PATCH request with correct userId and status", async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: true });
    global.fetch = mockFetch;

    await patchUserStatus("user-123", UserStatus.ACTIVE);

    expect(mockFetch).toHaveBeenCalledWith("/api/admin/users/user-123/status", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: UserStatus.ACTIVE }),
    });
  });

  it("should throw error with server message when response is not ok", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({ error: "無効なステータス遷移です" }),
    });

    await expect(
      patchUserStatus("user-123", UserStatus.ACTIVE)
    ).rejects.toThrow("無効なステータス遷移です");
  });

  it("should throw default error message when server returns no error field", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({}),
    });

    await expect(
      patchUserStatus("user-123", UserStatus.ACTIVE)
    ).rejects.toThrow("ステータス変更に失敗しました");
  });
});
