import { NextResponse } from "next/server";
import { z } from "zod";
import { getFlightLogService } from "@/lib/serviceFactory";
import { requireFlightAccess } from "@/lib/auth/requireFlightAccess";
import { InspectionListSchema } from "@/lib/zod/inspectionSchema";
import {
  BusinessError,
  AircraftNotFoundError,
  FlightPlanNotFoundError,
} from "@/services/errors";

const MAX_NOTE_LENGTH = 2000;

const CreateFlightLogSchema = z.object({
  aircraftId: z.string().min(1),
  flightPlanId: z.string().min(1).nullish(),
  startedAt: z.iso.datetime(),
  endedAt: z.iso.datetime(),
  location: z.string().min(1),
  pilotNote: z.string().max(MAX_NOTE_LENGTH).nullish(),
  incidentNote: z.string().max(MAX_NOTE_LENGTH).nullish(),
  inspections: InspectionListSchema,
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

  const service = getFlightLogService();
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
  const parsed = CreateFlightLogSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json({ error: "入力値が不正です" }, { status: 400 });
  }

  try {
    const service = getFlightLogService();
    const log = await service.create(
      {
        userId: auth.userId,
        aircraftId: parsed.data.aircraftId,
        flightPlanId: parsed.data.flightPlanId ?? null,
        startedAt: new Date(parsed.data.startedAt),
        endedAt: new Date(parsed.data.endedAt),
        location: parsed.data.location,
        pilotNote: parsed.data.pilotNote ?? null,
        incidentNote: parsed.data.incidentNote ?? null,
      },
      parsed.data.inspections,
      { userId: auth.userId, isAdmin: auth.isAdmin }
    );
    return NextResponse.json({ log }, { status: 201 });
  } catch (error) {
    if (error instanceof AircraftNotFoundError || error instanceof FlightPlanNotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    if (error instanceof BusinessError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ error: "内部エラーが発生しました" }, { status: 500 });
  }
}
