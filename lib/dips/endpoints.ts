import type { DipsRealm } from "@/lib/dips/config";

/**
 * DIPS 2.0 API エンドポイント定義 (接続システム向けガイドライン FPR v1.9 / FPA v1.4 準拠)
 *
 * ベース URL は realm 系統ごとに異なる:
 * - fpl 系 (飛行計画): fprApiBaseUrl (検証 https://www.stg.uafpi.dips.mlit.go.jp)
 * - req 系 (許可承認): fpaApiBaseUrl (検証 https://www.stg.uafp.dips.mlit.go.jp)
 *
 * 機体情報一覧取得 (utm-app 系) は DRS API ガイドライン §2.3.6 で仕様公開済み
 * (GET /utm/v1/aircrafts, realm drs-utm) だが未実装のため未定義 (docs/dips-rearchitecture-plan.md 参照)。
 */

export interface DipsEndpoint {
  method: "GET" | "POST";
  /** ベース URL からの相対パス */
  path: string;
  /** 認証に使う realm */
  realm: DipsRealm;
  /** どの系統のベース URL を使うか */
  apiBase: "fpr" | "fpa";
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
  /** 飛行計画通報受付 (fpl) */
  flightPlanRegister: {
    method: "POST",
    path: "/api/flight-plan/register",
    realm: "fpl",
    apiBase: "fpr",
  },
  /** 許可・承認情報取得 (req) */
  permissionList: {
    method: "GET",
    path: "/req-pub/api/v1/appliers/me/permissions",
    realm: "req",
    apiBase: "fpa",
  },
  /** 許可・承認申請受付 (req) */
  permissionRegister: {
    method: "POST",
    path: "/req-pub/api/v1/appliers/me/permissionRegister",
    realm: "req",
    apiBase: "fpa",
  },
} as const satisfies Record<string, DipsEndpoint>;
