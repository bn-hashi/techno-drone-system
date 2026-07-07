/**
 * `next start` をリバースプロキシ配下で動かす場合、request.url はアプリ自身の
 * bind アドレス (例: http://localhost:3000) を指し、外部の実アドレスを反映しない。
 * そのため絶対URLの構築 (ログイン後リダイレクト・DIPSコールバック・認証
 * ミドルウェア) には request.url ではなく APP_BASE_URL を使う。
 *
 * APP_BASE_URL が未設定のまま `new URL(path, undefined)` を呼ぶと
 * `TypeError: Invalid URL` で例外化するため、呼び出し側は必ず本関数で
 * 事前チェックし、未設定時は明示的に 500 を返すこと。
 */
export function isAppBaseUrlConfigured(): boolean {
  return Boolean(process.env.APP_BASE_URL);
}

export const APP_BASE_URL_MISSING_ERROR = "サーバー設定エラー: APP_BASE_URL が未設定です";
