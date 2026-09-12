import type { DipsRealm } from "@/lib/dips/config";

/**
 * DIPS 2.0 API エンドポイント定義 (接続システム向けガイドライン FPR v1.9 / FPA v1.4 準拠)
 *
 * ベース URL は realm 系統ごとに異なる:
 * - fpl 系 (飛行計画): fprApiBaseUrl (検証 https://www.stg.uafpi.dips.mlit.go.jp)
 * - req 系 (許可承認): fpaApiBaseUrl (検証 https://www.stg.uafp.dips.mlit.go.jp)
 * - utm 系 (機体情報一覧取得): drsApiBaseUrl (検証 https://www.dips-regdev.mlit.go.jp)。
 *   DRS API ガイドライン §2.3.6。他 2 系統とは認証・API のドメインが異なる
 */

export interface DipsEndpoint {
  method: "GET" | "POST";
  /** ベース URL からの相対パス */
  path: string;
  /** 認証に使う realm */
  realm: DipsRealm;
  /** どの系統のベース URL を使うか */
  apiBase: "fpr" | "fpa" | "drs";
  /**
   * 再送すると重複登録になりうる (非冪等な) 書き込み API かどうか。
   * `DipsApiClient.request()` はこのフラグが立つ API に対してのみ、タイムアウト時間を
   * 長めに取り、タイムアウト発生時は「受理済みの可能性がある」旨の専用エラー
   * (`DipsPossiblyAcceptedTimeoutError`) を投げる (2026-09-06 レビュー I1)。
   */
  isNonIdempotentWrite?: boolean;
  /**
   * エラー本文 (DIPS の `errorMessage`) を利用者向け UI にそのまま表示してよいか
   * (既定 false = fail-closed)。2026-09-11 req-014 課題2: DIPS のエラー本文には
   * 実装がエコーバックの有無を確認できていない項目 (氏名・住所・電話番号等) が
   * 含まれうる。DRS 系 (機体情報一覧取得) は `dipsApiClient.ts` のコメントで個人情報が
   * 乗りうることが明示されているため false のまま。req 系 (許可・承認申請受付) は
   * 操縦者の氏名・住所・電話を含む申請でエコーバックの懸念が fpl より高いため、
   * 人の決定 (2026-09-11) により今回は allowlist に入れない。fpl 系 (飛行計画通報・
   * 検索・飛行禁止エリア検索) のみ true にする (ガイドラインの異常時ボディは
   * `{"errorMessage": string}` の業務メッセージ1本のみ。§2.3.8 レスポンスサンプル参照)。
   * `lib/dips/dipsErrorMessage.ts` の `extractDisplayableDipsErrorMessage()` が参照する。
   */
  isErrorBodySafeToDisplay?: boolean;
  /**
   * エラー本文をログ・例外メッセージへ格納する際の最大長 (文字数)。省略時は
   * `isErrorBodySafeToDisplay` に応じた既定値 (false: 200 / true: 1000。PII 対策として
   * 最小限に切り詰める) を使う (2026-09-11 人の決定: 1000。§2.3.8 のエラー本文は業務
   * メッセージのみで PII を含まない設計のため、DRS 系より緩めてよいと判断)。
   *
   * `DipsApiClient.resolveErrorBodyPreviewLength()` がこの値を
   * `isErrorBodySafeToDisplay` に**従属させて**参照する (2026-09-11 /code-review 指摘3:
   * 以前はこのフィールド単独で参照しており、`isErrorBodySafeToDisplay` を true にせず
   * ここだけ引き上げると allowlist を経ずに PII がログへ残ってしまう構造的な穴があった)。
   * `isErrorBodySafeToDisplay` が false/未設定のエンドポイントでこの値を設定しても
   * 無視される。
   */
  errorBodyPreviewLength?: number;
}

export const DIPS_ENDPOINTS = {
  /**
   * 飛行計画情報取得 (fpl)。エラー本文は allowlist 対象 (2026-09-11 req-014 課題2。
   * §2.3.8 と同じ FPR ガイドラインの fpl 系 API であり、異常時ボディは業務メッセージ
   * のみと推定される)
   */
  flightPlanSearch: {
    method: "POST",
    path: "/api/flight-plan/search",
    realm: "fpl",
    apiBase: "fpr",
    isErrorBodySafeToDisplay: true,
    errorBodyPreviewLength: 1000,
  },
  /** 飛行禁止エリア情報取得 (fpl)。エラー本文は allowlist 対象 (上記と同じ理由) */
  flightProhibitedAreaSearch: {
    method: "POST",
    path: "/api/flight-prohibited-area/search",
    realm: "fpl",
    apiBase: "fpr",
    isErrorBodySafeToDisplay: true,
    errorBodyPreviewLength: 1000,
  },
  /**
   * 飛行計画通報受付 (fpl)。非冪等な登録系 POST (I1 参照)。
   * エラー本文は allowlist 対象 (2026-09-11 req-014 課題2: 本番実測の拒否理由
   * `{"errorMessage":"...予定開始時間が2日以前です。"}` およびガイドライン §2.3.8 の
   * 異常時レスポンスサンプルはいずれも業務メッセージ1本のみ)
   */
  flightPlanRegister: {
    method: "POST",
    path: "/api/flight-plan/register",
    realm: "fpl",
    apiBase: "fpr",
    isNonIdempotentWrite: true,
    isErrorBodySafeToDisplay: true,
    errorBodyPreviewLength: 1000,
  },
  /**
   * 許可・承認情報取得 (req)。エラー本文は allowlist 対象外
   * (`isErrorBodySafeToDisplay` 省略 = false のまま)
   */
  permissionList: {
    method: "GET",
    path: "/req-pub/api/v1/appliers/me/permissions",
    realm: "req",
    apiBase: "fpa",
  },
  /**
   * 許可・承認申請受付 (req)。134項目に及ぶ非冪等な登録系 POST (I1 参照)。
   * エラー本文は allowlist 対象外 (2026-09-11 人の決定 H-3: 申請内容に操縦者の氏名・
   * 住所・電話が含まれ、fpl 系よりエコーバックの可能性が高いと判断したため)
   */
  permissionRegister: {
    method: "POST",
    path: "/req-pub/api/v1/appliers/me/permissionRegister",
    realm: "req",
    apiBase: "fpa",
    isNonIdempotentWrite: true,
  },
  /**
   * 機体情報一覧取得 (utm, DRS API ガイドライン §2.3.6)。エラー本文は allowlist 対象外
   * (`dipsApiClient.ts` のコメントのとおり個人情報が乗りうることが明示されている)
   */
  aircraftList: {
    method: "GET",
    path: "/utm/v1/aircrafts",
    realm: "utm",
    apiBase: "drs",
  },
} as const satisfies Record<string, DipsEndpoint>;
