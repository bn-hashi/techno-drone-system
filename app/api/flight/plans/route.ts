import { NextResponse } from "next/server";
import { z } from "zod";
import { getFlightPlanService } from "@/lib/serviceFactory";
import { requireFlightAccess } from "@/lib/auth/requireFlightAccess";
import { BusinessError, AircraftNotFoundError } from "@/services/errors";

const CreateFlightPlanSchema = z.object({
  aircraftId: z.string().min(1),
  title: z.string().min(1),
  location: z.string().min(1),
  plannedAt: z.iso.datetime(),
  durationMin: z.number().int().positive(),
  purpose: z.string().min(1),
});

const ListQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().optional(),
});

export async function GET(request: Request): Promise<NextResponse> {
  const auth = await requireFlightAccess();
  if (!auth.ok) return auth.response;

  const { searchParams } = new URL(request.url);
  const parsedQuery = ListQuerySchema.safeParse({
    page: searchParams.get("page") ?? undefined,
    limit: searchParams.get("limit") ?? undefined,
  });
  if (!parsedQuery.success) {
    return NextResponse.json({ error: "クエリパラメータが不正です" }, { status: 400 });
  }

  const service = getFlightPlanService();
  const result = await service.list(
    { userId: auth.userId, isAdmin: auth.isAdmin },
    parsedQuery.data
  );
  return NextResponse.json(result, { status: 200 });
}

export async function POST(request: Request): Promise<NextResponse> {
  const auth = await requireFlightAccess();
  if (!auth.ok) return auth.response;

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
    const plan = await service.create(
      {
        userId: auth.userId,
        aircraftId: parsed.data.aircraftId,
        title: parsed.data.title,
        location: parsed.data.location,
        plannedAt: new Date(parsed.data.plannedAt),
        durationMin: parsed.data.durationMin,
        purpose: parsed.data.purpose,
      },
      { userId: auth.userId, isAdmin: auth.isAdmin }
    );
    return NextResponse.json({ plan }, { status: 201 });
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
