import { NextResponse } from "next/server";
import { getDipsService } from "@/lib/serviceFactory";
import { requireFlightAccess } from "@/lib/auth/requireFlightAccess";
import { handleDipsRouteError } from "@/lib/dips/handleRouteError";
import { DipsFlightPlanSearchInputSchema } from "@/lib/dips/flightPlanSearchInputSchema";

/**
 * 飛行計画情報取得 API (5-4, realm fpl) を検索する。
 *
 * DIPS 本体の API は POST + 検索条件ボディ (中心点・半径) のため、本システムの内部ルートも
 * POST とする (`app/api/dips/flight-prohibited-areas/search/route.ts` と同型)。
 *
 * ⚠️ 検証環境へのサンプルデータは未投入のため、疎通確認は「飛行計画通報受付API」(5-6) の
 * 成功が前提 (設定通知書「検証環境での確認ポイント」D36/E36 参照)。実装自体は完結している。
 */
export async function POST(request: Request): Promise<NextResponse> {
  const auth = await requireFlightAccess();
  if (!auth.ok) return auth.response;

  const rawBody = await request.json().catch(() => null);
  const parsed = DipsFlightPlanSearchInputSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json({ error: "入力値が不正です" }, { status: 400 });
  }

  try {
    const service = getDipsService();
    const { flightPlans, excludedCount } = await service.searchFlightPlans(
      auth.userId,
      parsed.data
    );
    return NextResponse.json({ flightPlans, excludedCount }, { status: 200 });
  } catch (error) {
    return handleDipsRouteError(error, {
      route: "POST /api/dips/flight-plans/search",
      label: "飛行計画情報",
    });
  }
}
