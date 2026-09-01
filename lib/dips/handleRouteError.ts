import { NextResponse } from "next/server";
import {
  DipsDisabledError,
  DipsConfigError,
  DipsAuthError,
  DipsApiError,
  DipsAuthRequiredError,
} from "@/lib/dips/errors";
import { logger } from "@/lib/logger";

/**
 * DIPS 連携 API ルートの catch ブロックを1本化する共通ハンドラ。
 *
 * `app/api/dips/aircrafts/route.ts` と `app/api/dips/permissions/route.ts` の catch
 * ブロックは、ログ・エラーメッセージの対象名が違うだけで分岐構造が完全に同一
 * (約30行、差分4行程度) だったため、5-3/5-4/5-5 の着手前にここへ1本化する
 * (2026-08-28 段階2共通化)。新しい DIPS API ルートを追加するときは、この関数へ
 * `route` (構造化ログの route フィールド) と `label` (エラーメッセージ用の対象名) を
 * 渡すだけで済む。
 */
export interface HandleDipsRouteErrorOptions {
  /** 構造化ログの route フィールド (例: "GET /api/dips/aircrafts") */
  route: string;
  /**
   * エラーメッセージに使う対象名 ("DIPS" 接頭辞は含めない。例: "機体情報一覧" /
   * "許可・承認情報")。`DIPS${label}取得に失敗しました` / `${label}取得で内部エラーが
   * 発生しました` の2箇所に埋め込む。
   */
  label: string;
}

/**
 * DIPS 連携 API 呼び出し中に発生した例外を、エラー種別ごとの HTTP レスポンスへ変換する。
 *
 * - `DipsDisabledError`: DIPS 連携が無効。503
 * - `DipsAuthRequiredError`: トークン未取得・失効。UI にログイン誘導させるため
 *   `authRequired: true` と realm を返す。realm は必ず `error.realm` を使い、
 *   呼び出し側でハードコードしない (2026-08-26 差し戻し D1: ルート側で realm を
 *   決め打ちすると、実際に投げられた realm とずれた場合に UI が誤った realm で
 *   ログイン誘導し無限ループになる事故があった。当初は許可・承認情報取得側にしか
 *   適用されておらず、機体情報一覧取得側は `realm: "utm"` のハードコードのままだった
 *   ため、共通化により両ルートへ適用する)
 * - `DipsConfigError`: 自システムの環境変数不足 (DIPS 側の障害ではない)。DIPS 側障害の
 *   502 と混同すると運用時の切り分け表 (docs/production-operations-runbook.md) で
 *   誤誘導するため区別し、503 を返す
 * - `DipsAuthError` / `DipsApiError`: DIPS 側のエラー。502
 * - それ以外: 自システムの内部エラー。500
 */
export function handleDipsRouteError(
  error: unknown,
  { route, label }: HandleDipsRouteErrorOptions
): NextResponse {
  if (error instanceof DipsDisabledError) {
    return NextResponse.json({ error: error.message }, { status: 503 });
  }

  if (error instanceof DipsAuthRequiredError) {
    return NextResponse.json(
      { error: error.message, authRequired: true, realm: error.realm },
      { status: 401 }
    );
  }

  if (error instanceof DipsConfigError) {
    logger.error("DIPS連携の設定が不足しています", error, { route });
    return NextResponse.json({ error: "DIPS連携の設定が不足しています" }, { status: 503 });
  }

  if (error instanceof DipsAuthError || error instanceof DipsApiError) {
    logger.error(`DIPS${label}取得に失敗しました`, error, { route });
    return NextResponse.json({ error: "DIPS連携でエラーが発生しました" }, { status: 502 });
  }

  logger.error(`${label}取得で内部エラーが発生しました`, error, { route });
  return NextResponse.json({ error: "内部エラーが発生しました" }, { status: 500 });
}
