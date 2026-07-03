import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

/**
 * DIPS トークンの保管用暗号化 (AES-256-GCM)
 *
 * DB に平文のアクセストークン/リフレッシュトークンを残さないための対称暗号。
 * 出力形式: base64( IV (12byte) || 認証タグ (16byte) || 暗号文 )
 */

const ALGORITHM = "aes-256-gcm";
/** GCM で推奨される IV 長 */
const IV_LENGTH_BYTES = 12;
/** GCM の認証タグ長 (デフォルト) */
const AUTH_TAG_LENGTH_BYTES = 16;

export function encryptToken(plainText: string, keyHex: string): string {
  const key = Buffer.from(keyHex, "hex");
  const iv = randomBytes(IV_LENGTH_BYTES);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plainText, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, encrypted]).toString("base64");
}

export function decryptToken(cipherText: string, keyHex: string): string {
  const key = Buffer.from(keyHex, "hex");
  const raw = Buffer.from(cipherText, "base64");
  const iv = raw.subarray(0, IV_LENGTH_BYTES);
  const authTag = raw.subarray(IV_LENGTH_BYTES, IV_LENGTH_BYTES + AUTH_TAG_LENGTH_BYTES);
  const encrypted = raw.subarray(IV_LENGTH_BYTES + AUTH_TAG_LENGTH_BYTES);
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
}
