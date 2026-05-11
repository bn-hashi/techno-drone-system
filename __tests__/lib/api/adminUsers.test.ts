import { describe, it, expect, vi, beforeEach } from "vitest";
import { postCreateUser, patchUserStatus } from "@/lib/api/adminUsers";
import { CourseType, UserStatus } from "@/types/prisma";

describe("postCreateUser", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("test_postCreateUser_sends_POST_request_with_correct_body", async () => {
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

  it("test_postCreateUser_throws_error_with_server_message_when_not_ok", async () => {
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

  it("test_postCreateUser_throws_default_error_when_no_error_field", async () => {
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

  it("test_patchUserStatus_sends_PATCH_request_with_correct_args", async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: true });
    global.fetch = mockFetch;

    await patchUserStatus("user-123", UserStatus.ACTIVE);

    expect(mockFetch).toHaveBeenCalledWith("/api/admin/users/user-123/status", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: UserStatus.ACTIVE }),
    });
  });

  it("test_patchUserStatus_throws_error_with_server_message_when_not_ok", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({ error: "無効なステータス遷移です" }),
    });

    await expect(patchUserStatus("user-123", UserStatus.ACTIVE)).rejects.toThrow(
      "無効なステータス遷移です"
    );
  });

  it("test_patchUserStatus_throws_default_error_when_no_error_field", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({}),
    });

    await expect(patchUserStatus("user-123", UserStatus.ACTIVE)).rejects.toThrow(
      "ステータス変更に失敗しました"
    );
  });
});
