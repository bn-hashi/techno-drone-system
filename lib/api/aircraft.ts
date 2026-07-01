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
  registrationNumber?: string;
}

export async function fetchAircrafts(activeOnly = true): Promise<AircraftDto[]> {
  const res = await fetch(`/api/flight/aircraft?activeOnly=${activeOnly}`);
  if (!res.ok) await throwOnError(res, "機体一覧の取得に失敗しました");
  const data = await res.json();
  return data.aircrafts as AircraftDto[];
}

export async function fetchAircraft(id: string): Promise<AircraftDto> {
  const res = await fetch(`/api/flight/aircraft/${id}`);
  if (!res.ok) await throwOnError(res, "機体情報の取得に失敗しました");
  const data = await res.json();
  return data.aircraft as AircraftDto;
}

export async function createAircraft(input: AircraftFormData): Promise<AircraftDto> {
  const res = await fetch("/api/flight/aircraft", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) await throwOnError(res, "機体の登録に失敗しました");
  const data = await res.json();
  return data.aircraft as AircraftDto;
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
  return data.aircraft as AircraftDto;
}

export async function deactivateAircraft(id: string): Promise<void> {
  const res = await fetch(`/api/flight/aircraft/${id}`, { method: "DELETE" });
  if (!res.ok) await throwOnError(res, "機体の削除に失敗しました");
}
