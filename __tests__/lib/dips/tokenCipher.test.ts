// @vitest-environment node
import { describe, it, expect } from "vitest";
import { encryptToken, decryptToken } from "@/lib/dips/tokenCipher";

const KEY_HEX = "0123456789abcdef".repeat(4); // 64桁 = 32byte
const OTHER_KEY_HEX = "fedcba9876543210".repeat(4);

describe("tokenCipher", () => {
  it("test_decrypt_returns_original_plaintext_after_encrypt", () => {
    const cipherText = encryptToken("access-token-value", KEY_HEX);

    expect(decryptToken(cipherText, KEY_HEX)).toBe("access-token-value");
  });

  it("test_encrypt_produces_different_ciphertext_each_call", () => {
    const first = encryptToken("same-input", KEY_HEX);
    const second = encryptToken("same-input", KEY_HEX);

    expect(first).not.toBe(second);
  });

  it("test_decrypt_throws_when_ciphertext_is_tampered", () => {
    const cipherText = encryptToken("access-token-value", KEY_HEX);
    const tampered = Buffer.from(cipherText, "base64");
    tampered[tampered.length - 1] ^= 0xff;

    expect(() => decryptToken(tampered.toString("base64"), KEY_HEX)).toThrow();
  });

  it("test_decrypt_throws_with_wrong_key", () => {
    const cipherText = encryptToken("access-token-value", KEY_HEX);

    expect(() => decryptToken(cipherText, OTHER_KEY_HEX)).toThrow();
  });
});
