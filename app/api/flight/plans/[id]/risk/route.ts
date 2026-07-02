import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getFlightPlanService } from "@/lib/serviceFactory";
import { AircraftRepository } from "@/repositories/aircraftRepository";
import { UserRole } from "@/types/prisma";
import { hasFlightAccess } from "@/lib/auth/flightPermissions";
import { FlightPlanNotFoundError } from "@/services/errors";
import { calcFallDistance } from "@/lib/utils/fallDistance";
import { getRiskStub } from "@/lib/stubs/weatherStub";

// Stub altitude used for fall-distance calculation (no real telemetry data)
const STUB_ALTITUDE_METERS = 50;

interface RouteContext {
  params: { id: string };
}

export async function GET(_request: Request, { params }: RouteContext): Promise<NextResponse> {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const role = session.user.role as UserRole;
  if (!hasFlightAccess(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = params;
  try {
    const service = getFlightPlanService();
    const plan = await service.findById(id, {
      userId: session.user.id,
      isAdmin: role === UserRole.ADMIN,
    });

    const aircraftRepo = new AircraftRepository();
    const aircraft = await aircraftRepo.findById(plan.aircraftId);
    if (!aircraft) {
      return NextResponse.json({ error: "機体情報が見つかりません" }, { status: 404 });
    }

    const fallDistanceM = calcFallDistance(aircraft.weightGrams, STUB_ALTITUDE_METERS);
    const risk = getRiskStub(fallDistanceM);

    return NextResponse.json({ risk }, { status: 200 });
  } catch (error) {
    if (error instanceof FlightPlanNotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    return NextResponse.json({ error: "内部エラーが発生しました" }, { status: 500 });
  }
}
