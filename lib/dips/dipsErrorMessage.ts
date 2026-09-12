import { DipsApiError } from "@/lib/dips/errors";

/**
 * DIPS API のエラーレスポンス (`{"errorMessage": string}`。FPRガイドライン v1.9 §2.3.8
 * ④レスポンス(エラー時) 参照) から、利用者に安全に表示できる拒否理由を取り出す
 * (2026-09-11 req-014 課題2)。
 *
 * 二重の歯止め (A∧B, 2026-09-11 planner計画 §2-1):
 * - A. allowlist: `error.isErrorBodySafeToDisplay` (`DipsApiClient.request()` が
 *   `DipsEndpoint.isErrorBodySafeToDisplay` から転記。既定 false = fail-closed) が
 *   true のエンドポイントのみ対象。DRS 系 (機体情報一覧取得) や req 系
 *   (許可・承認申請受付。人の決定 H-3) は個人情報のエコーバック懸念があるため対象外
 * - B. 構造で判断: allowlist を通過しても `responseBody` が
 *   `{"errorMessage": string}` の形として解析できたときだけ、その値だけを返す。
 *   `responseBody` の生文字列は絶対にそのまま返さない (未知のキーが増えても漏れない)
 *
 * どちらかを満たさなければ `null` を返す (呼び出し側は従来どおり汎用文言にフォールバック
 * する)。200文字/1000文字の切り詰め (`RESPONSE_BODY_PREVIEW_LENGTH` /
 * `DipsEndpoint.errorBodyPreviewLength`) で JSON が途中で切れた場合も `JSON.parse` が
 * 失敗するため、自然に `null` (fail-safe) になる。
 */
export function extractDisplayableDipsErrorMessage(error: unknown): string | null {
  if (!(error instanceof DipsApiError)) return null;
  if (!error.isErrorBodySafeToDisplay) return null;
  if (!error.responseBody) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(error.responseBody);
  } catch {
    return null;
  }

  if (typeof parsed !== "object" || parsed === null) return null;
  const message = (parsed as Record<string, unknown>).errorMessage;
  if (typeof message !== "string") return null;

  const trimmed = message.trim();
  return trimmed === "" ? null : trimmed;
}
