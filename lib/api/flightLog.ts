import { z } from "zod";
import { extractErrorMessage } from "@/lib/api/errorHelpers";
import type { InspectionPhase, InspectionResult } from "@/types/prisma";

async function throwOnError(res: Response, fallback: string): Promise<never> {
  const message = await extractErrorMessage(res, fallback);
  throw new Error(message);
}

async function parseJsonBody(res: Response, fallback: string): Promise<unknown> {
  try {
    return await res.json();
  } catch {
    throw new Error(fallback);
  }
}

export interface FlightLogInspectionInput {
  phase: InspectionPhase;
  itemKey: string;
  result: InspectionResult;
  note?: string;
}

export interface FlightLogFormData {
  aircraftId: string;
  flightPlanId: string | null;
  startedAt: string;
  endedAt: string;
  location: string;
  pilotNote: string | null;
  incidentNote: string | null;
  inspections: FlightLogInspectionInput[];
}

export interface FlightLogDto {
  id: string;
  userId: string;
  aircraftId: string;
  flightPlanId: string | null;
  startedAt: string;
  endedAt: string;
  durationMin: number;
  location: string;
  pilotNote: string | null;
  incidentNote: string | null;
  createdAt: string;
  updatedAt: string;
}

const FlightLogDtoSchema = z.object({
  id: z.string(),
  userId: z.string(),
  aircraftId: z.string(),
  flightPlanId: z.string().nullable(),
  startedAt: z.string(),
  endedAt: z.string(),
  durationMin: z.number(),
  location: z.string(),
  pilotNote: z.string().nullable(),
  incidentNote: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

const CreateFlightLogResponseSchema = z.object({ log: FlightLogDtoSchema });

export async function createFlightLog(input: FlightLogFormData): Promise<FlightLogDto> {
  const res = await fetch("/api/flight/logs", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) await throwOnError(res, "飛行日誌の作成に失敗しました");
  const data = await parseJsonBody(res, "飛行日誌の作成に失敗しました");
  const result = CreateFlightLogResponseSchema.safeParse(data);
  if (!result.success) {
    throw new Error("飛行日誌の作成に失敗しました: レスポンスの形式が不正です");
  }
  return result.data.log;
}
