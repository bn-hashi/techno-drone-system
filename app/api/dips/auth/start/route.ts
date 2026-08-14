import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getDipsService } from "@/lib/serviceFactory";
import { requireFlightAccess } from "@/lib/auth/requireFlightAccess";
import { DipsDisabledError, DipsConfigError } from "@/lib/dips/errors";
import { generateNonce, encodeAuthState, isDipsRealm } from "@/lib/dips/authState";
import type { DipsAuthStateRealm } from "@/lib/dips/authState";
import {
  DIPS_STATE_COOKIE_NAME,
  DIPS_RETURN_COOKIE_NAME,
  DIPS_STATE_COOKIE_MAX_AGE,
} from "@/lib/dips/authCookie";
import { isSafeInternalReturnPath } from "@/lib/dips/returnPath";
import { logger } from "@/lib/logger";

/** realm 追加時にここを更新し忘れないよう、既定値も定数として明示する */
const DEFAULT_DIPS_REALM: DipsAuthStateRealm = "fpl";

/**
 * realm クエリパラメータを解釈する。未知の値・未指定は既定 (fpl) にフォールバックする。
 * 妥当な realm かどうかの判定は `isDipsRealm` (DIPS_REALM_NAMES 由来) に一元化し、
 * ここでの再列挙 (ハードコード) を避ける。
 */
function parseRealmParam(raw: string | null): DipsAuthStateRealm {
  if (raw !== null && isDipsRealm(raw)) return raw;
  return DEFAULT_DIPS_REALM;
}

/**
 * DIPS ログイン (認可コードフロー) を開始する。
 * realm を指定し、state の nonce を httpOnly cookie に保存してから DIPS ログイン画面へリダイレクトする。
 * returnPath クエリ (検証済みのアプリ内パスのみ) を cookie に保存し、認可完了後の戻り先とする。
 */
export async function GET(request: Request): Promise<NextResponse> {
  const auth = await requireFlightAccess();
  if (!auth.ok) return auth.response;

  const searchParams = new URL(request.url).searchParams;
  const realm: DipsAuthStateRealm = parseRealmParam(searchParams.get("realm"));
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
    } else {
      // 過去の認可フローで保存した戻り先が残っていると、今回のコールバックで
      // 古いページへ誘導されてしまうため明示的に削除する
      cookies().delete(DIPS_RETURN_COOKIE_NAME);
    }

    return NextResponse.redirect(authorizationUrl);
  } catch (error) {
    if (error instanceof DipsDisabledError) {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }
    // 自システムの環境変数不足 (DIPS 側の障害ではない)。DipsDisabledError と同じく
    // 「連携を開始できる状態にない」ことが原因のため 503 とし、切り分けのため
    // 専用のログメッセージを残す (C1 と同じ方針: DIPS 側障害の 500 と区別する)
    if (error instanceof DipsConfigError) {
      logger.error("DIPS連携の設定が不足しています", error, {
        route: "GET /api/dips/auth/start",
      });
      return NextResponse.json({ error: error.message }, { status: 503 });
    }
    logger.error("DIPS認可開始でエラーが発生しました", error, {
      route: "GET /api/dips/auth/start",
    });
    return NextResponse.json({ error: "内部エラーが発生しました" }, { status: 500 });
  }
}
