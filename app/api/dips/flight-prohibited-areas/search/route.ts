import { NextResponse } from "next/server";
import { getDipsService } from "@/lib/serviceFactory";
import { requireFlightAccess } from "@/lib/auth/requireFlightAccess";
import { handleDipsRouteError } from "@/lib/dips/handleRouteError";
import { DipsFlightProhibitedAreaSearchInputSchema } from "@/lib/dips/flightProhibitedAreaSearchInputSchema";

/**
 * 飛行禁止エリア情報取得 API (5-5, realm fpl) を検索する。
 *
 * DIPS 本体の API は POST + 検索条件ボディ (中心点・半径・エリア種別) のため、本システムの
 * 内部ルートも POST とする (GET + クエリ文字列でジオメトリ配列を表現すると複雑になるため)。
 * `app/api/dips/permissions/route.ts` と同型 (エラー分類は共通ハンドラに委譲)。
 */
export async function POST(request: Request): Promise<NextResponse> {
  const auth = await requireFlightAccess();
  if (!auth.ok) return auth.response;

  const rawBody = await request.json().catch(() => null);
  const parsed = DipsFlightProhibitedAreaSearchInputSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json({ error: "入力値が不正です" }, { status: 400 });
  }

  try {
    const service = getDipsService();
    const { areas, excludedCount } = await service.searchFlightProhibitedAreas(
      auth.userId,
      parsed.data
    );
    return NextResponse.json({ areas, excludedCount }, { status: 200 });
  } catch (error) {
    return handleDipsRouteError(error, {
      route: "POST /api/dips/flight-prohibited-areas/search",
      label: "飛行禁止エリア情報",
    });
  }
}
