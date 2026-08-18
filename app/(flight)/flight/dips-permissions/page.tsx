import { requireFlightSession } from "@/lib/auth/requireFlightSession";
import { DipsPermissionsPanel } from "./DipsPermissionsPanel";

export const dynamic = "force-dynamic";

/**
 * DIPS 許可・承認情報取得 API (5-2) の疎通確認ページ。
 *
 * 許可・承認情報はアカウント単位の情報であり、特定の機体・飛行計画に紐づかないため、
 * 既存ページ (機体管理・飛行計画) には組み込まず独立ページとした。データ取得自体は
 * requireFlightAccess で保護された /api/dips/permissions が担うため、このページでは
 * 未ログイン・権限なしのユーザーを弾くだけでよい (requireFlightSession は
 * app/(flight)/layout.tsx でも呼ばれ二重にはなるが、機体管理ページ (flight/aircraft)
 * 等の既存ページも同様にページ単位で認可チェックを行っており、その規約に合わせている)。
 *
 * 現時点ではサイドナビ (lib/flightRoutes.ts) にリンクを追加していない (スコープを
 * 広げないための意図的な判断。詳細は req-009 builder 報告の「UI 導線」節を参照)。
 * 本番での疎通確認はこの URL に直接アクセスして行う。
 */
export default async function DipsPermissionsPage() {
  await requireFlightSession();

  return (
    <div className="p-6">
      <h1 className="mb-6 text-xl font-semibold text-gray-900">DIPS許可・承認情報</h1>
      <DipsPermissionsPanel />
    </div>
  );
}
