// サーバー/クライアント共用のロガー抽象
// プロジェクト規約により console.* の直接使用を避ける
// 将来 Sentry 等のリモートロガーへ差し替える場合もこの抽象を経由する
const isTest = process.env.NODE_ENV === "test";

interface ErrorContext {
  [key: string]: unknown;
}

function emitError(message: string, error?: unknown, context?: ErrorContext): void {
  // エラーは環境を問わず stderr へ出力する。本番 (next start + pm2) では
  // pm2 の error ログが唯一の障害調査手段のため、無音化してはならない。
  // テスト実行時のみ抑制し、エラー系テストの出力を汚さない。
  if (isTest) return;

  console.error(message, { error, context });
  // TODO: 本番ロガー（Sentry / Datadog 等）への転送を追加する。
}

export const logger = {
  error: emitError,
};
