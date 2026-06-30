import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getAircraftService } from "@/lib/serviceFactory";
import { UserRole } from "@/types/prisma";
import { hasFlightAccess } from "@/lib/auth/flightPermissions";
import { AircraftDuplicateSerialError, BusinessError } from "@/services/errors";

export async function GET(request: Request): Promise<NextResponse> {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const role = session.user.role as UserRole;
  if (!hasFlightAccess(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const activeOnly = searchParams.get("activeOnly") !== "false";

  try {
    const service = getAircraftService();
    const aircrafts = await service.list({
      userId: session.user.id,
      isAdmin: role === UserRole.ADMIN,
      activeOnly,
    });
    return NextResponse.json({ aircrafts }, { status: 200 });
  } catch {
    return NextResponse.json({ error: "内部エラーが発生しました" }, { status: 500 });
  }
}

export async function POST(request: Request): Promise<NextResponse> {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const role = session.user.role as UserRole;
  if (!hasFlightAccess(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "リクエストボディが不正です" }, { status: 400 });
  }

  const {
    name,
    manufacturer,
    modelNumber,
    serialNumber,
    weightGrams,
    maxFlightTimeMin,
    registrationNumber,
  } = body;

  if (
    !name ||
    !manufacturer ||
    !modelNumber ||
    !serialNumber ||
    weightGrams == null ||
    maxFlightTimeMin == null
  ) {
    return NextResponse.json({ error: "必須項目が不足しています" }, { status: 400 });
  }

  try {
    const service = getAircraftService();
    const aircraft = await service.create({
      userId: session.user.id,
      name,
      manufacturer,
      modelNumber,
      serialNumber,
      weightGrams: Number(weightGrams),
      maxFlightTimeMin: Number(maxFlightTimeMin),
      registrationNumber: registrationNumber ?? undefined,
    });
    return NextResponse.json({ aircraft }, { status: 201 });
  } catch (error) {
    if (error instanceof AircraftDuplicateSerialError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    if (error instanceof BusinessError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ error: "内部エラーが発生しました" }, { status: 500 });
  }
}
