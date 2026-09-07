import { requireFlightSession } from "@/lib/auth/requireFlightSession";
import { DipsPermissionApplyPanel } from "./DipsPermissionApplyPanel";

export const dynamic = "force-dynamic";

/**
 * 許可・承認申請受付 API (5-3) の疎通確認ページ。`/flight/dips-permissions` (5-2) 等と
 * 同じ位置づけの独立ページ (サイドナビ (`lib/flightRoutes.ts`) へのリンクは追加していない)。
 *
 * ⚠️ 検証環境の他事業者共用データベースへ実際に申請データを登録する操作のため、
 * 本番での疎通確認は慎重に (連打しない・必要な回数だけ) 実施すること。
 */
export default async function DipsPermissionApplyPage() {
  await requireFlightSession();

  return (
    <div className="p-6">
      <h1 className="mb-6 text-xl font-semibold text-gray-900">DIPS許可・承認申請受付</h1>
      <DipsPermissionApplyPanel />
    </div>
  );
}
