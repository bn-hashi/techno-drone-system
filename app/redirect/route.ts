import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getDipsService } from "@/lib/serviceFactory";
import { requireFlightAccess } from "@/lib/auth/requireFlightAccess";
import { DipsDisabledError } from "@/lib/dips/errors";
import { decodeAuthState } from "@/lib/dips/authState";
import { DIPS_STATE_COOKIE_NAME, DIPS_RETURN_COOKIE_NAME } from "@/lib/dips/authCookie";
import { isSafeInternalReturnPath } from "@/lib/dips/returnPath";
import { logger } from "@/lib/logger";
import { appBaseUrlGuard } from "@/lib/appBaseUrl";

/** 戻り先 cookie が無い・不正な場合に戻す既定の飛行計画一覧ページ */
const DEFAULT_RETURN_PATH = "/flight/plans";

/**
 * request.url ではなく APP_BASE_URL からリダイレクト先を組み立てる。
 * `next start` をリバースプロキシ配下で動かす場合、request.url はアプリ自身の
 * bind アドレス (例: http://localhost:3000) を指し、外部の実アドレスを反映しないため。
 */
function returnUrl(returnPath: string, query: string): URL {
  return new URL(`${returnPath}${query}`, process.env.APP_BASE_URL);
}

/**
 * 認可開始時に保存した戻り先 cookie を取り出して削除する。
 * cookie 値は攻撃者が直接操作しうるため、読み出し時にも必ず再検証し、
 * 不正値は既定の一覧ページへフォールバックする (オープンリダイレクト対策)。
 */
function consumeReturnPath(): string {
  const saved = cookies().get(DIPS_RETURN_COOKIE_NAME)?.value;
  cookies().delete(DIPS_RETURN_COOKIE_NAME);
  return isSafeInternalReturnPath(saved) ? saved : DEFAULT_RETURN_PATH;
}

/**
 * DIPS 認可コードフローのリダイレクト受け口 (DIPS に登録済みの redirect_uri: /redirect)。
 * state の nonce を cookie と照合 (CSRF 対策) し、認可コードをトークンに交換して保存する。
 */
export async function GET(request: Request): Promise<NextResponse> {
  // APP_BASE_URL 未設定のまま returnUrl() を呼ぶと Invalid URL で例外化するため、
  // 成功・失敗どちらの分岐に入る前にここで明示的に 500 を返す。
  const guardResponse = appBaseUrlGuard();
  if (guardResponse) return guardResponse;

  const auth = await requireFlightAccess();
  if (!auth.ok) return auth.response;

  const returnPath = consumeReturnPath();

  const params = new URL(request.url).searchParams;
  const code = params.get("code");
  const state = params.get("state");
  if (!code || !state) {
    return NextResponse.redirect(returnUrl(returnPath, "?dips=error"));
  }

  const decoded = decodeAuthState(state);
  const savedNonce = cookies().get(DIPS_STATE_COOKIE_NAME)?.value;
  cookies().delete(DIPS_STATE_COOKIE_NAME);
  if (!decoded || !savedNonce || decoded.nonce !== savedNonce) {
    logger.error("DIPS認可コールバックのstate検証に失敗しました", new Error("state mismatch"), {
      route: "GET /redirect",
    });
    return NextResponse.redirect(returnUrl(returnPath, "?dips=state_error"));
  }

  try {
    const service = getDipsService();
    await service.completeAuthorization(auth.userId, decoded.realm, code);
    return NextResponse.redirect(returnUrl(returnPath, "?dips=linked"));
  } catch (error) {
    if (error instanceof DipsDisabledError) {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }
    logger.error("DIPS認可コード交換でエラーが発生しました", error, {
      route: "GET /redirect",
    });
    return NextResponse.redirect(returnUrl(returnPath, "?dips=error"));
  }
}
