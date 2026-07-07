/**
 * 飛行管理機能のルート定義。
 * FlightLayout (操縦者/管理者共通ナビ) と AdminLayout (管理コンソールの
 * 飛行管理メニュー) の両方から参照され、href・ラベルの重複を防ぐ。
 */
export const FLIGHT_ROUTES = {
  aircraft: { href: "/flight/aircraft", label: "機体管理" },
  plans: { href: "/flight/plans", label: "飛行計画" },
  logs: { href: "/flight/logs", label: "飛行日誌" },
} as const;
