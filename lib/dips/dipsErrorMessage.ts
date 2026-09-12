import { DipsApiError } from "@/lib/dips/errors";

/**
 * 利用者向けに表示する `errorMessage` の最大長 (文字数)。
 *
 * 2026-09-12 CodeRabbit指摘1への対応: 以前は `DipsApiClient.request()` が
 * `DipsApiError.responseBody` (生の応答本文) 自体を1000文字へ切り詰めており、
 * 有効な JSON がその時点で壊れて `JSON.parse` に失敗していた。ここでは
 * `responseBody` は構造解析できる状態のまま受け取り (`lib/dips/dipsApiClient.ts` の
 * `MAX_STRUCTURED_ERROR_BODY_LENGTH` 参照)、JSON.parse で取り出した `errorMessage` の
 * 値だけをここで表示用の長さに制限する。
 */
const MAX_DISPLAYABLE_ERROR_MESSAGE_LENGTH = 1000;

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
 * する)。allowlist 対象外 (DRS/req 系) の PII 制限は `DipsApiClient.request()` 側の
 * 200文字切り詰め (`RESPONSE_BODY_PREVIEW_LENGTH`) が引き続き担い、そちらで JSON が
 * 途中で切れた場合も `JSON.parse` が失敗するため自然に `null` (fail-safe) になる。
 * allowlist 対象 (fpl 系) は本文を構造解析できる状態のまま受け取るため、抽出した
 * `errorMessage` の値自体を `MAX_DISPLAYABLE_ERROR_MESSAGE_LENGTH` (1000文字) で
 * 制限する (2026-09-12 CodeRabbit指摘1)。
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
  if (trimmed === "") return null;

  return trimmed.length > MAX_DISPLAYABLE_ERROR_MESSAGE_LENGTH
    ? trimmed.slice(0, MAX_DISPLAYABLE_ERROR_MESSAGE_LENGTH)
    : trimmed;
}
