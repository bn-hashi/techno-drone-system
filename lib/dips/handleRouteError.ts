import { NextResponse } from "next/server";
import {
  DipsDisabledError,
  DipsConfigError,
  DipsAuthError,
  DipsApiError,
  DipsAuthRequiredError,
  DipsPossiblyAcceptedTimeoutError,
  DipsAcceptedButUnreadableResultError,
} from "@/lib/dips/errors";
import { extractDisplayableDipsErrorMessage } from "@/lib/dips/dipsErrorMessage";
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
 *
 * 2026-09-02 差し戻し (H2): `app/api/flight/plans/[id]/dips-notify/route.ts` (飛行計画通報)
 * の catch ブロックが段階2共通化の移行漏れで独自コピーのまま残っており、
 * `DipsConfigError` を502で返す・realmを"fpl"にハードコードするなど分岐そのものが
 * 乖離していた ("片方だけ直る" 事故そのもの)。ここへ移行し、`actionVerb` /
 * `extraContext` オプションで POST 系ルート特有の文言・ログ項目 (飛行計画 ID) を維持できる
 * ようにした。
 */
export interface HandleDipsRouteErrorOptions {
  /** 構造化ログの route フィールド (例: "GET /api/dips/aircrafts") */
  route: string;
  /**
   * エラーメッセージに使う対象名 ("DIPS" 接頭辞は含めない。例: "機体情報一覧" /
   * "許可・承認情報")。`DIPS${label}${actionVerb}に失敗しました` /
   * `${label}${actionVerb}で内部エラーが発生しました` の2箇所に埋め込む。
   */
  label: string;
  /**
   * ログメッセージに使う動詞 (既定: "取得")。`GET /api/dips/*` 系は情報取得なので既定の
   * ままでよいが、飛行計画通報のような POST 系ルートでは「取得」がなじまない
   * (2026-09-02 差し戻し H2: 飛行計画通報ルートを共通ハンドラへ移行する際、既定のままだと
   * "DIPS飛行計画通報取得に失敗しました" という不自然な文言になり、
   * docs/production-operations-runbook.md が参照する既存ログ文言
   * ("DIPS飛行計画通報に失敗しました") とも一致しなくなる)。空文字を渡すと動詞なしになる。
   */
  actionVerb?: string;
  /**
   * ログの context に追加で含めるフィールド (例: 飛行計画通報ルートの飛行計画 ID)。
   * `route` と同じく PII を含めないこと。
   */
  extraContext?: Record<string, unknown>;
  /**
   * `DipsPossiblyAcceptedTimeoutError` (I1) 発生時、クライアントへの案内文に含める
   * 「登録状況を確認できる画面」の案内。呼び出し元 (許可・承認申請受付/飛行計画通報受付)
   * ごとに確認先の API が異なるため、ルート側から渡す。省略時は汎用文言になる。
   */
  timeoutRecoveryHint?: string;
}

/**
 * `DipsApiError` / `DipsAuthError` が保持する `status` / `responseBody` をログの
 * context に載せる形へ変換する (`DipsAuthError` には `responseBody` が存在しないため
 * `status` のみ)。
 *
 * 2026-09-08 対応: `logger` (lib/logger.ts) の `serializeError` は Error の
 * name/message/stack のみに絞り込む (PII を含みうる独自プロパティを露出しないための
 * ガード) ため、DIPS 固有のエラー種別が持つ `status` / `responseBody` は素通しでは
 * ログに出ない。これが原因で「DIPS が何を理由に拒否したか」が本番のログから分からず、
 * 飛行計画通報 (5-6) の DIPS 検証環境疎通確認が原因不明のまま止まっていた。
 * `responseBody` は `DipsApiClient.request()` が例外を投げる時点で既に PII 対策として
 * 200文字 (RESPONSE_BODY_PREVIEW_LENGTH) へ切り詰め済みの値をそのまま転記するだけで、
 * ここで新たに全文を持ち込むわけではない (lib/dips/dipsApiClient.ts 参照。この切り詰めは
 * 呼び出す API を区別せず一律に適用されている)。
 */
function dipsErrorLogContext(error: DipsAuthError | DipsApiError): Record<string, unknown> {
  return {
    status: error.status,
    ...(error instanceof DipsApiError ? { responseBody: error.responseBody } : {}),
  };
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
 * - `DipsPossiblyAcceptedTimeoutError`: 非冪等な登録系 POST がタイムアウトした
 *   (2026-09-06 レビュー I1)。DIPS 側で受理済みの可能性があるため、通常の
 *   `DipsApiError` (502・生成的な「エラーが発生しました」) とは別に、
 *   `possiblyAccepted: true` と「再送前に確認してください」の専用文言を返す。
 *   `DipsApiError` のサブクラスのため、このチェックは下の `DipsAuthError || DipsApiError`
 *   より前に置く必要がある
 * - `DipsAcceptedButUnreadableResultError`: 飛行計画通報受付 (5-6) が HTTP 200 を
 *   返した (= 受理済み) にもかかわらず flightPlanId を読み取れなかった (2026-09-11
 *   req-014 課題1)。I1 と同水準の `possiblyAccepted: true` を返すが、I1 (受理されたか
 *   不明) とは異なり「受理済みだが結果が読めない」ことを明示する専用文言にする。
 *   `DipsApiError` のサブクラスのため、これも `DipsAuthError || DipsApiError` より前に
 *   置く必要がある (I1 との順序はどちらが先でもよい。互いのサブクラスではないため)
 * - `DipsAuthError` / `DipsApiError`: DIPS 側のエラー。502。ログの context に
 *   `dipsErrorLogContext` (上記) の `status` / `responseBody` を含める (2026-09-08 対応)。
 *   `extractDisplayableDipsErrorMessage()` が allowlist (fpl 系のみ) を通過した場合に
 *   限り、DIPS の拒否理由をそのまま利用者向けメッセージにする (2026-09-11 req-014 課題2。
 *   PII を含みうる DRS/req 系は対象外で、従来どおり汎用文言のまま)
 * - それ以外: 自システムの内部エラー。500
 */
export function handleDipsRouteError(
  error: unknown,
  {
    route,
    label,
    actionVerb = "取得",
    extraContext,
    timeoutRecoveryHint,
  }: HandleDipsRouteErrorOptions
): NextResponse {
  const context = { route, ...extraContext };

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
    logger.error("DIPS連携の設定が不足しています", error, context);
    return NextResponse.json({ error: "DIPS連携の設定が不足しています" }, { status: 503 });
  }

  if (error instanceof DipsPossiblyAcceptedTimeoutError) {
    logger.error(`DIPS${label}${actionVerb}がタイムアウトしました (受理済みの可能性があります)`, error, {
      ...context,
      ...dipsErrorLogContext(error),
    });
    const hint = timeoutRecoveryHint ?? "再送する前に登録状況を確認してください";
    return NextResponse.json(
      {
        error: `${label}${actionVerb}がタイムアウトしました。DIPS側で受理済みの可能性があります。${hint}`,
        possiblyAccepted: true,
      },
      { status: 502 }
    );
  }

  if (error instanceof DipsAcceptedButUnreadableResultError) {
    logger.error(
      `DIPS${label}${actionVerb}の受付結果を読み取れませんでした (受理済みの可能性があります)`,
      error,
      { ...context, ...dipsErrorLogContext(error) }
    );
    return NextResponse.json(
      {
        error:
          `${label}${actionVerb}はDIPS側で受理されましたが、受付結果(飛行計画ID)を読み取れませんでした。` +
          "再度通報しないでください(重複通報になります)。DIPSのサイトで登録状況をご確認ください。",
        possiblyAccepted: true,
      },
      { status: 502 }
    );
  }

  if (error instanceof DipsAuthError || error instanceof DipsApiError) {
    logger.error(`DIPS${label}${actionVerb}に失敗しました`, error, {
      ...context,
      ...dipsErrorLogContext(error),
    });
    const displayableMessage = extractDisplayableDipsErrorMessage(error);
    return NextResponse.json(
      { error: displayableMessage ?? "DIPS連携でエラーが発生しました" },
      { status: 502 }
    );
  }

  logger.error(`${label}${actionVerb}で内部エラーが発生しました`, error, context);
  return NextResponse.json({ error: "内部エラーが発生しました" }, { status: 500 });
}
