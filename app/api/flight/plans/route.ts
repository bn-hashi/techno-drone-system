import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { getFlightPlanService } from "@/lib/serviceFactory";
import { UserRole } from "@/types/prisma";
import { hasFlightAccess } from "@/lib/auth/flightPermissions";
import { BusinessError } from "@/services/errors";

const CreateFlightPlanSchema = z.object({
  aircraftId: z.string().min(1),
  title: z.string().min(1),
  location: z.string().min(1),
  plannedAt: z.string().datetime(),
  durationMin: z.number().int().positive(),
  purpose: z.string().min(1),
});

export async function GET(_request: Request): Promise<NextResponse> {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const role = session.user.role as UserRole;
  if (!hasFlightAccess(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const service = getFlightPlanService();
  const plans = await service.list({
    userId: session.user.id,
    isAdmin: role === UserRole.ADMIN,
  });
  return NextResponse.json({ plans }, { status: 200 });
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

  const rawBody = await request.json().catch(() => null);
  if (!rawBody) {
    return NextResponse.json({ error: "リクエストボディが不正です" }, { status: 400 });
  }
  const parsed = CreateFlightPlanSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json({ error: "入力値が不正です" }, { status: 400 });
  }

  try {
    const service = getFlightPlanService();
    const plan = await service.create({
      userId: session.user.id,
      aircraftId: parsed.data.aircraftId,
      title: parsed.data.title,
      location: parsed.data.location,
      plannedAt: new Date(parsed.data.plannedAt),
      durationMin: parsed.data.durationMin,
      purpose: parsed.data.purpose,
    });
    return NextResponse.json({ plan }, { status: 201 });
  } catch (error) {
    if (error instanceof BusinessError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ error: "内部エラーが発生しました" }, { status: 500 });
  }
}
