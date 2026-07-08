import { NextResponse } from "next/server";

/**
 * `next start` をリバースプロキシ配下で動かす場合、request.url はアプリ自身の
 * bind アドレス (例: http://localhost:3000) を指し、外部の実アドレスを反映しない。
 * そのため絶対URLの構築 (ログイン後リダイレクト・DIPSコールバック・認証
 * ミドルウェア) には request.url ではなく APP_BASE_URL を使う。
 *
 * APP_BASE_URL が未設定、またはURLとして構築できない値のまま
 * `new URL(path, ...)` を呼ぶと `TypeError: Invalid URL` で例外化するため、
 * 呼び出し側は必ず `appBaseUrlGuard()` で事前チェックすること。
 */
export function isAppBaseUrlConfigured(): boolean {
  const url = process.env.APP_BASE_URL;
  if (!url) return false;
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

export const APP_BASE_URL_MISSING_ERROR = "サーバー設定エラー: APP_BASE_URL が未設定です";

/**
 * APP_BASE_URL が未設定/不正な場合に 500 レスポンスを返す共通ガード。
 * 呼び出し元は戻り値が non-null なら即座にそれを return すること。
 */
export function appBaseUrlGuard(): NextResponse | null {
  if (!isAppBaseUrlConfigured()) {
    return NextResponse.json({ error: APP_BASE_URL_MISSING_ERROR }, { status: 500 });
  }
  return null;
}
