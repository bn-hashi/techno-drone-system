import { NextResponse } from "next/server";
import { getFlightPlanService } from "@/lib/serviceFactory";
import { requireFlightAccess } from "@/lib/auth/requireFlightAccess";
import { FlightPlanNotFoundError, AircraftNotFoundError } from "@/services/errors";

interface RouteContext {
  params: { id: string };
}

export async function GET(_request: Request, { params }: RouteContext): Promise<NextResponse> {
  const auth = await requireFlightAccess();
  if (!auth.ok) return auth.response;

  const { id } = params;
  try {
    const service = getFlightPlanService();
    const risk = await service.getRisk(id, { userId: auth.userId, isAdmin: auth.isAdmin });
    return NextResponse.json({ risk }, { status: 200 });
  } catch (error) {
    if (error instanceof FlightPlanNotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    if (error instanceof AircraftNotFoundError) {
      return NextResponse.json({ error: "機体情報が見つかりません" }, { status: 404 });
    }
    return NextResponse.json({ error: "内部エラーが発生しました" }, { status: 500 });
  }
}
