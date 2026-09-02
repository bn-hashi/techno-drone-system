import { NextResponse } from "next/server";
import { getDipsService } from "@/lib/serviceFactory";
import { requireFlightAccess } from "@/lib/auth/requireFlightAccess";
import { AircraftNotFoundError, FlightPlanNotFoundError, BusinessError } from "@/services/errors";
import { DipsNotifyInputSchema } from "@/lib/dips/notifyInputSchema";
import { handleDipsRouteError } from "@/lib/dips/handleRouteError";

interface RouteContext {
  params: { id: string };
}

/** 飛行計画を DIPS 2.0 飛行計画通報受付 API へ通報する */
export async function POST(request: Request, { params }: RouteContext): Promise<NextResponse> {
  const auth = await requireFlightAccess();
  if (!auth.ok) return auth.response;

  const rawBody = await request.json().catch(() => null);
  const parsed = DipsNotifyInputSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json({ error: "入力値が不正です" }, { status: 400 });
  }

  const { id } = params;
  try {
    const service = getDipsService();
    const result = await service.notifyFlightPlan(id, parsed.data, {
      userId: auth.userId,
      isAdmin: auth.isAdmin,
    });
    return NextResponse.json({ result }, { status: 200 });
  } catch (error) {
    if (error instanceof FlightPlanNotFoundError || error instanceof AircraftNotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    if (error instanceof BusinessError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    // DIPS 連携由来のエラー (Disabled/AuthRequired/Config/Auth/Api) とそれ以外の内部エラーは
    // 共通ハンドラへ委譲する (2026-09-02 差し戻し H2: このルートだけ独自 catch ブロックの
    // コピーが残っており、`DipsConfigError` を502で返す・realmを"fpl"にハードコードする等
    // 共通ハンドラ (aircrafts/permissions が既に移行済み) と分岐そのものが乖離していた)。
    // `actionVerb: ""` と `extraContext: { id }` で、移行前と同じログ文言
    // ("DIPS飛行計画通報に失敗しました" 等) と飛行計画 ID の記録を維持する。
    return handleDipsRouteError(error, {
      route: "POST /api/flight/plans/[id]/dips-notify",
      label: "飛行計画通報",
      actionVerb: "",
      extraContext: { id },
    });
  }
}
