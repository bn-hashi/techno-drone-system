import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { getAircraftService } from "@/lib/serviceFactory";
import { UserRole } from "@/types/prisma";
import { hasFlightAccess } from "@/lib/auth/flightPermissions";
import { AircraftNotFoundError, BusinessError } from "@/services/errors";

const UpdateAircraftSchema = z.object({
  name: z.string().min(1).optional(),
  manufacturer: z.string().min(1).optional(),
  modelNumber: z.string().min(1).optional(),
  weightGrams: z.number().int().positive().optional(),
  maxFlightTimeMin: z.number().int().positive().optional(),
  registrationNumber: z.string().optional(),
});

interface RouteContext {
  params: Promise<{ id: string }>;
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

  const { id } = await params;
  try {
    const service = getAircraftService();
    const aircraft = await service.findById(id, {
      userId: session.user.id,
      isAdmin: role === UserRole.ADMIN,
    });
    return NextResponse.json({ aircraft }, { status: 200 });
  } catch (error) {
    if (error instanceof AircraftNotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    return NextResponse.json({ error: "内部エラーが発生しました" }, { status: 500 });
  }
}

export async function PUT(request: Request, { params }: RouteContext): Promise<NextResponse> {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const role = session.user.role as UserRole;
  if (!hasFlightAccess(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const rawBody = await request.json().catch(() => null);
  if (!rawBody) {
    return NextResponse.json({ error: "リクエストボディが不正です" }, { status: 400 });
  }
  const parsed = UpdateAircraftSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json({ error: "入力値が不正です" }, { status: 400 });
  }

  try {
    const service = getAircraftService();
    const aircraft = await service.update(id, parsed.data, {
      userId: session.user.id,
      isAdmin: role === UserRole.ADMIN,
    });
    return NextResponse.json({ aircraft }, { status: 200 });
  } catch (error) {
    if (error instanceof AircraftNotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    if (error instanceof BusinessError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ error: "内部エラーが発生しました" }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: RouteContext): Promise<NextResponse> {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const role = session.user.role as UserRole;
  if (!hasFlightAccess(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  try {
    const service = getAircraftService();
    await service.deactivate(id, {
      userId: session.user.id,
      isAdmin: role === UserRole.ADMIN,
    });
    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    if (error instanceof AircraftNotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    return NextResponse.json({ error: "内部エラーが発生しました" }, { status: 500 });
  }
}
