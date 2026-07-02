/**
 * DIPS 2.0 API エンドポイントパス
 *
 * ⚠️ 暫定値: R08-DRS-0005 設定通知書にはエンドポイントパスの記載がないため、
 * 「DIPS2.0 API 接続システム向けガイドライン」の正式仕様と突合して確定させること。
 * 検証環境での疎通確認 (本番サーバー上) の際に必ず見直す。
 */
export const DIPS_ENDPOINTS = {
  /** 機体情報一覧取得 */
  aircraftList: "/api/v1/aircrafts",
  /** 許可・承認情報取得 */
  permissionList: "/api/v1/permissions",
  /** 許可・承認申請受付 */
  permissionApplication: "/api/v1/permission-applications",
  /** 飛行計画情報取得 */
  flightPlanList: "/api/v1/flight-plans",
  /** 飛行禁止エリア情報取得 */
  noFlyAreaList: "/api/v1/no-fly-areas",
  /** 飛行計画通報受付 */
  flightPlanNotification: "/api/v1/flight-plan-notifications",
} as const;
