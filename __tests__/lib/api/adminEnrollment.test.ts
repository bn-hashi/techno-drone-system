import { describe, it, expect, vi, beforeEach } from "vitest";
import { postCreateEnrollment } from "@/lib/api/adminEnrollment";

describe("postCreateEnrollment", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  const validInput = {
    userId: "user-1",
    dateOfBirth: "1990-01-01",
    address: "東京都渋谷区1-1-1",
    phoneNumber: "090-1234-5678",
  };

  it("test_postCreateEnrollment_sends_POST_to_correct_endpoint", async () => {
    // Arrange
    const mockFetch = vi.fn().mockResolvedValue({ ok: true });
    global.fetch = mockFetch;

    // Act
    await postCreateEnrollment(validInput);

    // Assert
    expect(mockFetch).toHaveBeenCalledWith(
      "/api/admin/enrollment",
      expect.objectContaining({ method: "POST" })
    );
  });

  it("test_postCreateEnrollment_sends_correct_body", async () => {
    // Arrange
    const mockFetch = vi.fn().mockResolvedValue({ ok: true });
    global.fetch = mockFetch;

    // Act
    await postCreateEnrollment(validInput);

    // Assert
    const [, options] = mockFetch.mock.calls[0];
    expect(options.headers).toEqual({ "Content-Type": "application/json" });
    expect(options.body).toBe(JSON.stringify(validInput));
  });

  it("test_postCreateEnrollment_resolves_when_response_is_ok", async () => {
    // Arrange
    global.fetch = vi.fn().mockResolvedValue({ ok: true });

    // Act & Assert
    await expect(postCreateEnrollment(validInput)).resolves.toBeUndefined();
  });

  it("test_postCreateEnrollment_throws_server_error_message_when_not_ok", async () => {
    // Arrange
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({ error: "申請情報が不正です" }),
    });

    // Act & Assert
    await expect(postCreateEnrollment(validInput)).rejects.toThrow(
      "申請情報が不正です"
    );
  });

  it("test_postCreateEnrollment_throws_default_error_when_no_error_field", async () => {
    // Arrange
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({}),
    });

    // Act & Assert
    await expect(postCreateEnrollment(validInput)).rejects.toThrow(
      "申請登録に失敗しました"
    );
  });
});
