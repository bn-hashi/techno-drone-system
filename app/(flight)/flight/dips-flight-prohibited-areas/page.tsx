import { requireFlightSession } from "@/lib/auth/requireFlightSession";
import { DipsFlightProhibitedAreaSearchPanel } from "./DipsFlightProhibitedAreaSearchPanel";

export const dynamic = "force-dynamic";

/**
 * 飛行禁止エリア情報取得 API (5-5) の疎通確認ページ。`/flight/dips-permissions` (5-2) と
 * 同じ位置づけ (アカウント・機体・飛行計画のいずれにも紐づかない検索系 API のため独立
 * ページとし、サイドナビ (`lib/flightRoutes.ts`) へのリンクは追加していない。本番での
 * 疎通確認はこの URL に直接アクセスして行う)。
 *
 * データ取得自体は requireFlightAccess で保護された
 * `POST /api/dips/flight-prohibited-areas/search` が担うため、このページでは
 * 未ログイン・権限なしのユーザーを弾くだけでよい。
 */
export default async function DipsFlightProhibitedAreasPage() {
  await requireFlightSession();

  return (
    <div className="p-6">
      <h1 className="mb-6 text-xl font-semibold text-gray-900">DIPS飛行禁止エリア情報</h1>
      <DipsFlightProhibitedAreaSearchPanel />
    </div>
  );
}
