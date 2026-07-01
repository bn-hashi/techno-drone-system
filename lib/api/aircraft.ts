import { z } from "zod";
import { extractErrorMessage } from "@/lib/api/errorHelpers";

async function throwOnError(res: Response, fallback: string): Promise<never> {
  const message = await extractErrorMessage(res, fallback);
  throw new Error(message);
}

export interface AircraftDto {
  id: string;
  userId: string;
  name: string;
  manufacturer: string;
  modelNumber: string;
  serialNumber: string;
  weightGrams: number;
  maxFlightTimeMin: number;
  registrationNumber: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AircraftFormData {
  name: string;
  manufacturer: string;
  modelNumber: string;
  serialNumber: string;
  weightGrams: number;
  maxFlightTimeMin: number;
  registrationNumber?: string | null;
}

const AircraftDtoSchema = z.object({
  id: z.string(),
  userId: z.string(),
  name: z.string(),
  manufacturer: z.string(),
  modelNumber: z.string(),
  serialNumber: z.string(),
  weightGrams: z.number(),
  maxFlightTimeMin: z.number(),
  registrationNumber: z.string().nullable(),
  isActive: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

function parseAircraftDto(raw: unknown, context: string): AircraftDto {
  const result = AircraftDtoSchema.safeParse(raw);
  if (!result.success) {
    throw new Error(`${context}: レスポンスの形式が不正です`);
  }
  return result.data;
}

export async function fetchAircrafts(activeOnly = true): Promise<AircraftDto[]> {
  const res = await fetch(`/api/flight/aircraft?activeOnly=${activeOnly}`);
  if (!res.ok) await throwOnError(res, "機体一覧の取得に失敗しました");
  const data = await res.json();
  const result = z.array(AircraftDtoSchema).safeParse(data.aircrafts);
  if (!result.success) {
    throw new Error("機体一覧の取得に失敗しました: レスポンスの形式が不正です");
  }
  return result.data;
}

export async function fetchAircraft(id: string): Promise<AircraftDto> {
  const res = await fetch(`/api/flight/aircraft/${id}`);
  if (!res.ok) await throwOnError(res, "機体情報の取得に失敗しました");
  const data = await res.json();
  return parseAircraftDto(data.aircraft, "機体情報の取得に失敗しました");
}

export async function createAircraft(input: AircraftFormData): Promise<AircraftDto> {
  const res = await fetch("/api/flight/aircraft", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) await throwOnError(res, "機体の登録に失敗しました");
  const data = await res.json();
  return parseAircraftDto(data.aircraft, "機体の登録に失敗しました");
}

export async function updateAircraft(
  id: string,
  input: Partial<AircraftFormData>
): Promise<AircraftDto> {
  const res = await fetch(`/api/flight/aircraft/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) await throwOnError(res, "機体の更新に失敗しました");
  const data = await res.json();
  return parseAircraftDto(data.aircraft, "機体の更新に失敗しました");
}

export async function deactivateAircraft(id: string): Promise<void> {
  const res = await fetch(`/api/flight/aircraft/${id}`, { method: "DELETE" });
  if (!res.ok) await throwOnError(res, "機体の削除に失敗しました");
}
