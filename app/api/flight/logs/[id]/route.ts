import { NextResponse } from "next/server";
import { getFlightLogService } from "@/lib/serviceFactory";
import { requireFlightAccess } from "@/lib/auth/requireFlightAccess";
import { FlightLogNotFoundError } from "@/services/errors";

interface RouteContext {
  params: { id: string };
}

export async function GET(_request: Request, { params }: RouteContext): Promise<NextResponse> {
  const auth = await requireFlightAccess();
  if (!auth.ok) return auth.response;

  const { id } = params;
  try {
    const service = getFlightLogService();
    const log = await service.findById(id, { userId: auth.userId, isAdmin: auth.isAdmin });
    return NextResponse.json({ log }, { status: 200 });
  } catch (error) {
    if (error instanceof FlightLogNotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    return NextResponse.json({ error: "内部エラーが発生しました" }, { status: 500 });
  }
}
