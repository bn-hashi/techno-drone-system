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
  /** 機体情報一覧取得 (utm, DRS API ガイドライン §2.3.6) */
  aircraftList: {
    method: "GET",
    path: "/utm/v1/aircrafts",
    realm: "utm",
    apiBase: "drs",
  },
} as const satisfies Record<string, DipsEndpoint>;
