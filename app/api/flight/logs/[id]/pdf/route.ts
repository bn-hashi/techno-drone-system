import { NextResponse } from "next/server";
import { getFlightLogService } from "@/lib/serviceFactory";
import { requireFlightAccess } from "@/lib/auth/requireFlightAccess";
import { generateFlightLogPdf } from "@/lib/pdf/generateFlightLogPdf";
import { FlightLogNotFoundError } from "@/services/errors";

export const runtime = "nodejs";

interface RouteContext {
  params: { id: string };
}

/** JST 基準の YYYYMMDD (Content-Disposition 用に ASCII のみ) */
function formatFilenameDate(date: Date): string {
  return date
    .toLocaleDateString("ja-JP", {
      timeZone: "Asia/Tokyo",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    })
    .replaceAll("/", "");
}

export async function GET(_request: Request, { params }: RouteContext): Promise<Response> {
  const auth = await requireFlightAccess();
  if (!auth.ok) return auth.response;

  const { id } = params;
  try {
    const service = getFlightLogService();
    const log = await service.findByIdForPdf(id, { userId: auth.userId, isAdmin: auth.isAdmin });

    const buffer = await generateFlightLogPdf({
      pilotName: log.user.name,
      aircraftName: log.aircraft.name,
      aircraftManufacturer: log.aircraft.manufacturer,
      registrationNumber: log.aircraft.registrationNumber,
      location: log.location,
      purpose: log.flightPlan?.purpose ?? null,
      startedAt: log.startedAt,
      endedAt: log.endedAt,
      durationMin: log.durationMin,
      pilotNote: log.pilotNote,
      incidentNote: log.incidentNote,
      inspections: log.inspections.map((inspection) => ({
        phase: inspection.phase,
        itemKey: inspection.itemKey,
        result: inspection.result,
        note: inspection.note,
      })),
    });

    const filename = `flight-log-${formatFilenameDate(log.startedAt)}.pdf`;
    return new Response(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "content-type": "application/pdf",
        "content-disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    if (error instanceof FlightLogNotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    return NextResponse.json({ error: "内部エラーが発生しました" }, { status: 500 });
  }
}
