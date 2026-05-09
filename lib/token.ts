import { createHmac, timingSafeEqual } from "crypto";

// トークンの有効期間: 72時間 (ミリ秒)
// 受講者がメール受信後に手続きを完了するための猶予期間
const TOKEN_EXPIRY_MS = 72 * 60 * 60 * 1000;

interface TokenPayload {
  userId: string;
  exp: number;
}

function getSecret(): string {
  const secret = process.env.INVITE_TOKEN_SECRET;
  if (!secret) {
    throw new Error("環境変数 INVITE_TOKEN_SECRET が設定されていません");
  }
  return secret;
}

function toBase64Url(input: string): string {
  return Buffer.from(input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
}

function computeHmac(payloadBase64: string, secret: string): string {
  const hmac = createHmac("sha256", secret);
  hmac.update(payloadBase64);
  return hmac.digest("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

/**
 * 招待用 HMAC-SHA256 ステートレストークンを生成する
 *
 * フォーマット: base64url(payload).base64url(hmac-sha256)
 *
 * @param userId - 招待対象のユーザー ID
 * @returns Base64URL エンコードされたトークン文字列
 */
export function generateInviteToken(userId: string): string {
  const secret = getSecret();
  const payload: TokenPayload = {
    userId,
    exp: Date.now() + TOKEN_EXPIRY_MS,
  };
  const payloadBase64 = toBase64Url(JSON.stringify(payload));
  const signature = computeHmac(payloadBase64, secret);
  return `${payloadBase64}.${signature}`;
}

/**
 * 招待トークンを検証し、ペイロードを返す
 *
 * 署名不一致・有効期限切れ・不正フォーマットの場合は null を返す。
 *
 * @param token - 検証対象のトークン文字列
 * @returns 有効なトークンの場合は { userId }、無効な場合は null
 */
export function verifyInviteToken(token: string): { userId: string } | null {
  if (!token) {
    return null;
  }

  const parts = token.split(".");
  if (parts.length !== 2) {
    return null;
  }

  const [payloadBase64, signature] = parts;

  try {
    const secret = getSecret();
    const expectedSignature = computeHmac(payloadBase64, secret);

    // タイミング攻撃対策のため timingSafeEqual を使用
    const sigBuffer = Buffer.from(signature);
    const expectedBuffer = Buffer.from(expectedSignature);
    if (sigBuffer.length !== expectedBuffer.length || !timingSafeEqual(sigBuffer, expectedBuffer)) {
      return null;
    }

    const payloadJson = Buffer.from(payloadBase64, "base64").toString("utf-8");
    const payload = JSON.parse(payloadJson) as TokenPayload;

    if (Date.now() > payload.exp) {
      return null;
    }

    return { userId: payload.userId };
  } catch {
    return null;
  }
}
