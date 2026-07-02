import { NextResponse } from "next/server";
import { getDipsService } from "@/lib/serviceFactory";
import { requireFlightAccess } from "@/lib/auth/requireFlightAccess";
import { AircraftNotFoundError, BusinessError } from "@/services/errors";
import { DipsDisabledError, DipsConfigError, DipsAuthError, DipsApiError } from "@/lib/dips/errors";
import { logger } from "@/lib/logger";

interface RouteContext {
  params: { id: string };
}

/** 機体の登録記号を DIPS 2.0 機体情報一覧取得 API と照合する */
export async function POST(_request: Request, { params }: RouteContext): Promise<NextResponse> {
  const auth = await requireFlightAccess();
  if (!auth.ok) return auth.response;

  const { id } = params;
  try {
    const service = getDipsService();
    const result = await service.verifyAircraftRegistration(id, {
      userId: auth.userId,
      isAdmin: auth.isAdmin,
    });
    return NextResponse.json({ result }, { status: 200 });
  } catch (error) {
    if (error instanceof DipsDisabledError) {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }
    if (error instanceof AircraftNotFoundError) {
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
      logger.error("DIPS機体照合に失敗しました", error, {
        route: "POST /api/flight/aircraft/[id]/verify-registration",
        id,
      });
      return NextResponse.json({ error: "DIPS連携でエラーが発生しました" }, { status: 502 });
    }
    logger.error("機体照合で内部エラーが発生しました", error, {
      route: "POST /api/flight/aircraft/[id]/verify-registration",
      id,
    });
    return NextResponse.json({ error: "内部エラーが発生しました" }, { status: 500 });
  }
}
