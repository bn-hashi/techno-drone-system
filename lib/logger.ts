// サーバー/クライアント共用のロガー抽象
// プロジェクト規約により console.* の直接使用を避ける
// 将来 Sentry 等のリモートロガーへ差し替える場合もこの抽象を経由する
const isTest = process.env.NODE_ENV === "test";

// context には呼び出し側で PII を含めないこと（route 名など安全な識別情報のみ）。
// 本番では stderr（pm2 の error ログ）へそのまま出力されるため。
interface ErrorContext {
  [key: string]: unknown;
}

/**
 * 例外を安全な形へ変換する。
 * Error はそのまま出すと独自プロパティ（例: Prisma エラーの meta に含まれる
 * クエリ引数）まで露出しうるため、name / message / stack のみに絞る。
 * Error 以外は文字列化して型情報の混入や巨大オブジェクトの出力を防ぐ。
 */
function serializeError(error: unknown): unknown {
  if (error === undefined) return undefined;
  if (error instanceof Error) {
    return { name: error.name, message: error.message, stack: error.stack };
  }
  return String(error);
}

function emitError(message: string, error?: unknown, context?: ErrorContext): void {
  // エラーは環境を問わず stderr へ出力する。本番 (next start + pm2) では
  // pm2 の error ログが唯一の障害調査手段のため、無音化してはならない。
  // テスト実行時のみ抑制し、エラー系テストの出力を汚さない。
  if (isTest) return;

  console.error(message, { error: serializeError(error), context });
  // TODO: 本番ロガー（Sentry / Datadog 等）への転送を追加する。
}

export const logger = {
  error: emitError,
};
