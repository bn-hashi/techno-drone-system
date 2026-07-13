import { NextResponse } from "next/server";
import { getDipsService } from "@/lib/serviceFactory";
import { requireFlightAccess } from "@/lib/auth/requireFlightAccess";
import { AircraftNotFoundError, FlightPlanNotFoundError, BusinessError } from "@/services/errors";
import {
  DipsDisabledError,
  DipsConfigError,
  DipsAuthError,
  DipsApiError,
  DipsAuthRequiredError,
} from "@/lib/dips/errors";
import { DipsNotifyInputSchema } from "@/lib/dips/notifyInputSchema";
import { logger } from "@/lib/logger";

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
    if (error instanceof DipsDisabledError) {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }
    // トークン未取得・失効: UI にログイン誘導させるため専用フラグを返す
    if (error instanceof DipsAuthRequiredError) {
      return NextResponse.json(
        { error: error.message, authRequired: true, realm: "fpl" },
        { status: 401 }
      );
    }
    if (error instanceof FlightPlanNotFoundError || error instanceof AircraftNotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    if (error instanceof BusinessError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    if (
      error instanceof DipsConfigError ||
      error instanceof DipsAuthError ||
      error instanceof DipsApiError
    ) {
      logger.error("DIPS飛行計画通報に失敗しました", error, {
        route: "POST /api/flight/plans/[id]/dips-notify",
        id,
      });
      return NextResponse.json({ error: "DIPS連携でエラーが発生しました" }, { status: 502 });
    }
    logger.error("飛行計画通報で内部エラーが発生しました", error, {
      route: "POST /api/flight/plans/[id]/dips-notify",
      id,
    });
    return NextResponse.json({ error: "内部エラーが発生しました" }, { status: 500 });
  }
}
