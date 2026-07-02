import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { getFlightPlanService } from "@/lib/serviceFactory";
import { UserRole } from "@/types/prisma";
import { hasFlightAccess } from "@/lib/auth/flightPermissions";
import {
  FlightPlanNotFoundError,
  FlightPlanInvalidTransitionError,
  BusinessError,
} from "@/services/errors";
import { FlightPlanStatus } from "@prisma/client";

const UpdateFlightPlanSchema = z.object({
  title: z.string().min(1).optional(),
  location: z.string().min(1).optional(),
  plannedAt: z.string().datetime().optional(),
  durationMin: z.number().int().positive().optional(),
  purpose: z.string().min(1).optional(),
});

const UpdateStatusSchema = z.object({
  status: z.nativeEnum(FlightPlanStatus),
});

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
    return NextResponse.json({ plan }, { status: 200 });
  } catch (error) {
    if (error instanceof FlightPlanNotFoundError) {
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

  const { id } = params;
  const rawBody = await request.json().catch(() => null);
  if (!rawBody) {
    return NextResponse.json({ error: "リクエストボディが不正です" }, { status: 400 });
  }
  const parsed = UpdateFlightPlanSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json({ error: "入力値が不正です" }, { status: 400 });
  }

  const data = parsed.data;
  try {
    const service = getFlightPlanService();
    const updatedPlan = await service.update(
      id,
      { ...data, plannedAt: data.plannedAt ? new Date(data.plannedAt) : undefined },
      { userId: session.user.id, isAdmin: role === UserRole.ADMIN },
    );
    return NextResponse.json({ plan: updatedPlan }, { status: 200 });
  } catch (error) {
    if (error instanceof FlightPlanNotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    if (error instanceof BusinessError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ error: "内部エラーが発生しました" }, { status: 500 });
  }
}

export async function PATCH(request: Request, { params }: RouteContext): Promise<NextResponse> {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const role = session.user.role as UserRole;
  if (!hasFlightAccess(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = params;
  const rawBody = await request.json().catch(() => null);
  if (!rawBody) {
    return NextResponse.json({ error: "リクエストボディが不正です" }, { status: 400 });
  }
  const parsed = UpdateStatusSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json({ error: "入力値が不正です" }, { status: 400 });
  }

  try {
    const service = getFlightPlanService();
    const plan = await service.updateStatus(id, parsed.data.status, {
      userId: session.user.id,
      isAdmin: role === UserRole.ADMIN,
    });
    return NextResponse.json({ plan }, { status: 200 });
  } catch (error) {
    if (error instanceof FlightPlanNotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    if (error instanceof FlightPlanInvalidTransitionError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ error: "内部エラーが発生しました" }, { status: 500 });
  }
}
