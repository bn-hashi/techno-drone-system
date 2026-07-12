import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getDipsService } from "@/lib/serviceFactory";
import { requireFlightAccess } from "@/lib/auth/requireFlightAccess";
import { DipsDisabledError } from "@/lib/dips/errors";
import { generateNonce, encodeAuthState } from "@/lib/dips/authState";
import type { DipsAuthStateRealm } from "@/lib/dips/authState";
import {
  DIPS_STATE_COOKIE_NAME,
  DIPS_RETURN_COOKIE_NAME,
  DIPS_STATE_COOKIE_MAX_AGE,
} from "@/lib/dips/authCookie";
import { isSafeInternalReturnPath } from "@/lib/dips/returnPath";
import { logger } from "@/lib/logger";

/**
 * DIPS ログイン (認可コードフロー) を開始する。
 * realm を指定し、state の nonce を httpOnly cookie に保存してから DIPS ログイン画面へリダイレクトする。
 * returnPath クエリ (検証済みのアプリ内パスのみ) を cookie に保存し、認可完了後の戻り先とする。
 */
export async function GET(request: Request): Promise<NextResponse> {
  const auth = await requireFlightAccess();
  if (!auth.ok) return auth.response;

  const searchParams = new URL(request.url).searchParams;
  const realmParam = searchParams.get("realm");
  const realm: DipsAuthStateRealm = realmParam === "req" ? "req" : "fpl";
  const returnPathParam = searchParams.get("returnPath");

  try {
    const service = getDipsService();
    const nonce = generateNonce();
    const state = encodeAuthState(realm, nonce);
    const authorizationUrl = service.buildAuthorizationUrl(realm, state);

    cookies().set(DIPS_STATE_COOKIE_NAME, nonce, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
      maxAge: DIPS_STATE_COOKIE_MAX_AGE,
    });

    // 検証を通らない returnPath は黙って無視する (認可完了後は既定の一覧へ戻る)。
    // 攻撃者が操作しうる値のため、保存するのは検証済みパスのみ。
    if (isSafeInternalReturnPath(returnPathParam)) {
      cookies().set(DIPS_RETURN_COOKIE_NAME, returnPathParam, {
        httpOnly: true,
        secure: true,
        sameSite: "lax",
        path: "/",
        maxAge: DIPS_STATE_COOKIE_MAX_AGE,
      });
    }

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
