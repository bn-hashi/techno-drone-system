import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getDipsService } from "@/lib/serviceFactory";
import { requireFlightAccess } from "@/lib/auth/requireFlightAccess";
import { DipsDisabledError } from "@/lib/dips/errors";
import { generateNonce, encodeAuthState } from "@/lib/dips/authState";
import type { DipsAuthStateRealm } from "@/lib/dips/authState";
import { logger } from "@/lib/logger";

/** state 照合用 nonce を保持する cookie 名 */
const STATE_COOKIE_NAME = "dips_auth_state";
/** nonce cookie の有効期間 (秒)。認可フロー完了までの短時間で十分 */
const STATE_COOKIE_MAX_AGE = 600;

/**
 * DIPS ログイン (認可コードフロー) を開始する。
 * realm を指定し、state の nonce を httpOnly cookie に保存してから DIPS ログイン画面へリダイレクトする。
 */
export async function GET(request: Request): Promise<NextResponse> {
  const auth = await requireFlightAccess();
  if (!auth.ok) return auth.response;

  const realmParam = new URL(request.url).searchParams.get("realm");
  const realm: DipsAuthStateRealm = realmParam === "req" ? "req" : "fpl";

  try {
    const service = getDipsService();
    const nonce = generateNonce();
    const state = encodeAuthState(realm, nonce);
    const authorizationUrl = service.buildAuthorizationUrl(realm, state);

    cookies().set(STATE_COOKIE_NAME, nonce, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
      maxAge: STATE_COOKIE_MAX_AGE,
    });

    return NextResponse.redirect(authorizationUrl);
  } catch (error) {
    if (error instanceof DipsDisabledError) {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }
    logger.error("DIPS認可開始でエラーが発生しました", error, {
      route: "GET /api/dips/auth/start",
    });
    return NextResponse.json({ error: "内部エラーが発生しました" }, { status: 500 });
  }
}

export { STATE_COOKIE_NAME };
