import { requireFlightSession } from "@/lib/auth/requireFlightSession";
import { DipsFlightPlanSearchPanel } from "./DipsFlightPlanSearchPanel";

export const dynamic = "force-dynamic";

/**
 * 飛行計画情報取得 API (5-4) の疎通確認ページ。`/flight/dips-permissions` (5-2) /
 * `/flight/dips-flight-prohibited-areas` (5-5) と同じ位置づけの独立ページ
 * (サイドナビ (`lib/flightRoutes.ts`) へのリンクは追加していない)。
 *
 * ⚠️ 検証環境へのサンプルデータは未投入のため、疎通確認は「飛行計画通報受付API」(5-6) の
 * 成功が前提 (設定通知書「検証環境での確認ポイント」D36/E36 参照)。
 */
export default async function DipsFlightPlansPage() {
  await requireFlightSession();

  return (
    <div className="p-6">
      <h1 className="mb-6 text-xl font-semibold text-gray-900">DIPS飛行計画情報</h1>
      <p className="mb-4 text-xs text-gray-500">
        検証環境へのサンプルデータは未投入のため、事前に飛行計画通報 (DIPSへ通報) が必要です
      </p>
      <DipsFlightPlanSearchPanel />
    </div>
  );
}
