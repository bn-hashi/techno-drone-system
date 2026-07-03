import { randomBytes } from "crypto";

/**
 * DIPS 認可コードフローの state (CSRF 対策) をエンコード/デコードする。
 *
 * state には realm と nonce を含める。nonce は httpOnly cookie に保存した値と
 * コールバック時に照合し、リクエストの正当性を検証する。
 */

import type { DipsRealm } from "@/lib/dips/config";

/** DipsRealm の別名 (state 用途)。定義は lib/dips/config.ts に一元化 */
export type DipsAuthStateRealm = DipsRealm;

const SEPARATOR = ".";

export function generateNonce(): string {
  return randomBytes(16).toString("hex");
}

export function encodeAuthState(realm: DipsAuthStateRealm, nonce: string): string {
  return `${realm}${SEPARATOR}${nonce}`;
}

export function decodeAuthState(
  state: string
): { realm: DipsAuthStateRealm; nonce: string } | null {
  const [realm, nonce] = state.split(SEPARATOR);
  if ((realm !== "fpl" && realm !== "req") || !nonce) {
    return null;
  }
  return { realm, nonce };
}
