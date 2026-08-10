import { randomBytes } from "crypto";

/**
 * DIPS 認可コードフローの state (CSRF 対策) をエンコード/デコードする。
 *
 * state には realm と nonce を含める。nonce は httpOnly cookie に保存した値と
 * コールバック時に照合し、リクエストの正当性を検証する。
 */

import { DIPS_REALM_NAMES } from "@/lib/dips/config";
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

/** realm が DIPS_REALM_NAMES に定義済みか判定する (realm 追加時のハードコード列挙を避ける) */
function isDipsRealm(value: string): value is DipsAuthStateRealm {
  return Object.prototype.hasOwnProperty.call(DIPS_REALM_NAMES, value);
}

export function decodeAuthState(
  state: string
): { realm: DipsAuthStateRealm; nonce: string } | null {
  const [realm, nonce] = state.split(SEPARATOR);
  if (!nonce || !isDipsRealm(realm)) {
    return null;
  }
  return { realm, nonce };
}
