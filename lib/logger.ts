// クライアントサイド用ロガー抽象
// プロジェクト規約により console.* の直接使用を避ける
// 開発時は console、将来は Sentry 等のリモートロガーに差し替え可能
const isDev = process.env.NODE_ENV !== "production";

interface ErrorContext {
  [key: string]: unknown;
}

function emitError(message: string, error?: unknown, context?: ErrorContext): void {
  if (isDev) {
    // 開発時のみ console を使用（本番ではノイズを避け、別のシンクへ転送する想定）

    console.error(message, { error, context });
    return;
  }
  // TODO: 本番ロガー（Sentry / Datadog 等）に接続する。
  // 接続前は無音にして PII やノイズが流れないようにする。
}

export const logger = {
  error: emitError,
};
