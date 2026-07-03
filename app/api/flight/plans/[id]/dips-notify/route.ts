import { NextResponse } from "next/server";
import { z } from "zod";
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
import type { DipsFlightPurposeCode } from "@/lib/dips/types";
import { logger } from "@/lib/logger";

interface RouteContext {
  params: { id: string };
}

/** 飛行目的コードの上限 (FPRガイドライン 2.3.8: 1〜16) */
const MAX_FLIGHT_PURPOSE_CODE = 16;
/** 速度・高度の上限 (FPRガイドライン 2.3.8: 1〜999) */
const MAX_SPEED_KMH = 999;
const MAX_ALTITUDE_M = 999;

// FlightPlan/Aircraft から導出できない通報項目 (Q1=(a): ダイアログ入力)
const NotifyInputSchema = z.object({
  flightPurpose: z
    .array(
      z
        .number()
        .int()
        .min(1)
        .max(MAX_FLIGHT_PURPOSE_CODE)
        .transform((code) => code as DipsFlightPurposeCode)
    )
    .min(1),
  flightAirspace: z.array(z.number().int()).min(1),
  assistantsNumber: z.number().int().min(0),
  departurePoint: z.string().min(1),
  destinationPoint: z.string().min(1),
  flightSpeed: z.number().int().min(1).max(MAX_SPEED_KMH),
  flightAltitude: z.number().int().min(1).max(MAX_ALTITUDE_M),
  flyRoute: z.string().min(1),
  riskMitigationOnsiteControl: z.boolean(),
});

/** 飛行計画を DIPS 2.0 飛行計画通報受付 API へ通報する */
export async function POST(request: Request, { params }: RouteContext): Promise<NextResponse> {
  const auth = await requireFlightAccess();
  if (!auth.ok) return auth.response;

  const rawBody = await request.json().catch(() => null);
  const parsed = NotifyInputSchema.safeParse(rawBody);
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
