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
}

export const DIPS_ENDPOINTS = {
  /** 飛行計画情報取得 (fpl) */
  flightPlanSearch: {
    method: "POST",
    path: "/api/flight-plan/search",
    realm: "fpl",
    apiBase: "fpr",
  },
  /** 飛行禁止エリア情報取得 (fpl) */
  flightProhibitedAreaSearch: {
    method: "POST",
    path: "/api/flight-prohibited-area/search",
    realm: "fpl",
    apiBase: "fpr",
  },
  /** 飛行計画通報受付 (fpl)。非冪等な登録系 POST (I1 参照) */
  flightPlanRegister: {
    method: "POST",
    path: "/api/flight-plan/register",
    realm: "fpl",
    apiBase: "fpr",
    isNonIdempotentWrite: true,
  },
  /** 許可・承認情報取得 (req) */
  permissionList: {
    method: "GET",
    path: "/req-pub/api/v1/appliers/me/permissions",
    realm: "req",
    apiBase: "fpa",
  },
  /** 許可・承認申請受付 (req)。134項目に及ぶ非冪等な登録系 POST (I1 参照) */
  permissionRegister: {
    method: "POST",
    path: "/req-pub/api/v1/appliers/me/permissionRegister",
    realm: "req",
    apiBase: "fpa",
    isNonIdempotentWrite: true,
  },
  /** 機体情報一覧取得 (utm, DRS API ガイドライン §2.3.6) */
  aircraftList: {
    method: "GET",
    path: "/utm/v1/aircrafts",
    realm: "utm",
    apiBase: "drs",
  },
} as const satisfies Record<string, DipsEndpoint>;
