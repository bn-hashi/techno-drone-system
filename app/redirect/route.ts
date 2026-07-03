import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getDipsService } from "@/lib/serviceFactory";
import { requireFlightAccess } from "@/lib/auth/requireFlightAccess";
import { DipsDisabledError } from "@/lib/dips/errors";
import { decodeAuthState } from "@/lib/dips/authState";
import { STATE_COOKIE_NAME } from "@/app/api/dips/auth/start/route";
import { logger } from "@/lib/logger";

/** 認可完了後に戻す飛行計画一覧ページ */
const RETURN_PATH = "/flight/plans";

/**
 * DIPS 認可コードフローのリダイレクト受け口 (DIPS に登録済みの redirect_uri: /redirect)。
 * state の nonce を cookie と照合 (CSRF 対策) し、認可コードをトークンに交換して保存する。
 */
export async function GET(request: Request): Promise<NextResponse> {
  const auth = await requireFlightAccess();
  if (!auth.ok) return auth.response;

  const params = new URL(request.url).searchParams;
  const code = params.get("code");
  const state = params.get("state");
  if (!code || !state) {
    return NextResponse.redirect(new URL(`${RETURN_PATH}?dips=error`, request.url));
  }

  const decoded = decodeAuthState(state);
  const savedNonce = cookies().get(STATE_COOKIE_NAME)?.value;
  cookies().delete(STATE_COOKIE_NAME);
  if (!decoded || !savedNonce || decoded.nonce !== savedNonce) {
    logger.error("DIPS認可コールバックのstate検証に失敗しました", new Error("state mismatch"), {
      route: "GET /redirect",
    });
    return NextResponse.redirect(new URL(`${RETURN_PATH}?dips=state_error`, request.url));
  }

  try {
    const service = getDipsService();
    await service.completeAuthorization(auth.userId, decoded.realm, code);
    return NextResponse.redirect(new URL(`${RETURN_PATH}?dips=linked`, request.url));
  } catch (error) {
    if (error instanceof DipsDisabledError) {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }
    logger.error("DIPS認可コード交換でエラーが発生しました", error, {
      route: "GET /redirect",
    });
    return NextResponse.redirect(new URL(`${RETURN_PATH}?dips=error`, request.url));
  }
}
