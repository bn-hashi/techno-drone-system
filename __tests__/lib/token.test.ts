import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// INVITE_TOKEN_SECRET をテスト用に設定してからモジュールをインポートする
const TEST_SECRET = "test-secret-32-bytes-long-enough!";

describe("lib/token", () => {
  beforeEach(() => {
    vi.resetModules();
    process.env.INVITE_TOKEN_SECRET = TEST_SECRET;
  });

  afterEach(() => {
    delete process.env.INVITE_TOKEN_SECRET;
  });

  describe("generateInviteToken", () => {
    it("test_generateInviteToken_returns_string", async () => {
      // Arrange
      const { generateInviteToken } = await import("@/lib/token");

      // Act
      const token = generateInviteToken("user-123");

      // Assert
      expect(typeof token).toBe("string");
    });

    it("test_generateInviteToken_returns_base64url_encoded_string_without_padding_chars", async () => {
      // Arrange
      const { generateInviteToken } = await import("@/lib/token");

      // Act
      const token = generateInviteToken("user-123");

      // Assert - Base64URL 各パートは =, +, / を含まない
      const [payload, signature] = token.split(".");
      expect(payload).toMatch(/^[A-Za-z0-9_-]+$/);
      expect(signature).toMatch(/^[A-Za-z0-9_-]+$/);
    });

    it("test_generateInviteToken_contains_two_dots_as_separators", async () => {
      // Arrange
      const { generateInviteToken } = await import("@/lib/token");

      // Act
      const token = generateInviteToken("user-123");

      // Assert - payload.signature 形式
      const parts = token.split(".");
      expect(parts).toHaveLength(2);
    });

    it("test_generateInviteToken_different_users_produce_different_tokens", async () => {
      // Arrange
      const { generateInviteToken } = await import("@/lib/token");

      // Act
      const token1 = generateInviteToken("user-1");
      const token2 = generateInviteToken("user-2");

      // Assert
      expect(token1).not.toBe(token2);
    });

    it("test_generateInviteToken_without_secret_throws_error", async () => {
      // Arrange
      delete process.env.INVITE_TOKEN_SECRET;

      // Act & Assert
      await expect(async () => {
        const { generateInviteToken } = await import("@/lib/token");
        generateInviteToken("user-123");
      }).rejects.toThrow();
    });
  });

  describe("verifyInviteToken", () => {
    it("test_verifyInviteToken_valid_token_returns_userId", async () => {
      // Arrange
      const { generateInviteToken, verifyInviteToken } = await import("@/lib/token");
      const token = generateInviteToken("user-abc");

      // Act
      const result = verifyInviteToken(token);

      // Assert
      expect(result).not.toBeNull();
    });

    it("test_verifyInviteToken_valid_token_returns_correct_userId", async () => {
      // Arrange
      const { generateInviteToken, verifyInviteToken } = await import("@/lib/token");
      const token = generateInviteToken("user-abc");

      // Act
      const result = verifyInviteToken(token);

      // Assert
      expect(result?.userId).toBe("user-abc");
    });

    it("test_verifyInviteToken_tampered_payload_returns_null", async () => {
      // Arrange
      const { generateInviteToken, verifyInviteToken } = await import("@/lib/token");
      const token = generateInviteToken("user-abc");
      const [, signature] = token.split(".");
      // payload を別のユーザーIDに改ざん
      const fakePayload = Buffer.from(
        JSON.stringify({ userId: "attacker", exp: Date.now() + 99999999 })
      )
        .toString("base64")
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=/g, "");
      const tamperedToken = `${fakePayload}.${signature}`;

      // Act
      const result = verifyInviteToken(tamperedToken);

      // Assert
      expect(result).toBeNull();
    });

    it("test_verifyInviteToken_expired_token_returns_null", async () => {
      // Arrange - 有効期限を過去に設定したトークンを直接作成
      // crypto モジュールを使って期限切れトークンを生成する
      const crypto = await import("node:crypto");
      const payload = { userId: "user-old", exp: Date.now() - 1000 }; // 過去
      const payloadBase64 = Buffer.from(JSON.stringify(payload))
        .toString("base64")
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=/g, "");
      const hmac = crypto.createHmac("sha256", TEST_SECRET);
      hmac.update(payloadBase64);
      const signature = hmac
        .digest("base64")
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=/g, "");
      const expiredToken = `${payloadBase64}.${signature}`;

      const { verifyInviteToken } = await import("@/lib/token");

      // Act
      const result = verifyInviteToken(expiredToken);

      // Assert
      expect(result).toBeNull();
    });

    it("test_verifyInviteToken_malformed_token_returns_null", async () => {
      // Arrange
      const { verifyInviteToken } = await import("@/lib/token");

      // Act
      const result = verifyInviteToken("not-a-valid-token");

      // Assert
      expect(result).toBeNull();
    });

    it("test_verifyInviteToken_empty_string_returns_null", async () => {
      // Arrange
      const { verifyInviteToken } = await import("@/lib/token");

      // Act
      const result = verifyInviteToken("");

      // Assert
      expect(result).toBeNull();
    });

    it("test_verifyInviteToken_token_with_wrong_secret_returns_null", async () => {
      // Arrange
      const crypto = await import("node:crypto");
      const payload = { userId: "user-123", exp: Date.now() + 99999999 };
      const payloadBase64 = Buffer.from(JSON.stringify(payload))
        .toString("base64")
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=/g, "");
      const hmac = crypto.createHmac("sha256", "wrong-secret");
      hmac.update(payloadBase64);
      const signature = hmac
        .digest("base64")
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=/g, "");
      const wrongSecretToken = `${payloadBase64}.${signature}`;

      const { verifyInviteToken } = await import("@/lib/token");

      // Act
      const result = verifyInviteToken(wrongSecretToken);

      // Assert
      expect(result).toBeNull();
    });
  });
});
