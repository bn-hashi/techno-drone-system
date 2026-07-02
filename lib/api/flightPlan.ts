import { z } from "zod";
import { extractErrorMessage } from "@/lib/api/errorHelpers";

async function throwOnError(res: Response, fallback: string): Promise<never> {
  const message = await extractErrorMessage(res, fallback);
  throw new Error(message);
}

export type FlightPlanStatus = "DRAFT" | "APPROVED" | "REJECTED" | "COMPLETED";

export interface FlightPlanDto {
  id: string;
  userId: string;
  aircraftId: string;
  title: string;
  location: string;
  plannedAt: string;
  durationMin: number;
  purpose: string;
  status: FlightPlanStatus;
  createdAt: string;
  updatedAt: string;
}

export interface FlightPlanFormData {
  aircraftId: string;
  title: string;
  location: string;
  plannedAt: string;
  durationMin: number;
  purpose: string;
}

const FlightPlanDtoSchema = z.object({
  id: z.string(),
  userId: z.string(),
  aircraftId: z.string(),
  title: z.string(),
  location: z.string(),
  plannedAt: z.string(),
  durationMin: z.number(),
  purpose: z.string(),
  status: z.enum(["DRAFT", "APPROVED", "REJECTED", "COMPLETED"]),
  createdAt: z.string(),
  updatedAt: z.string(),
});

function parsePlanDto(raw: unknown, context: string): FlightPlanDto {
  const result = FlightPlanDtoSchema.safeParse(raw);
  if (!result.success) {
    throw new Error(`${context}: レスポンスの形式が不正です`);
  }
  return result.data;
}

export async function fetchFlightPlans(): Promise<FlightPlanDto[]> {
  const res = await fetch("/api/flight/plans");
  if (!res.ok) await throwOnError(res, "飛行計画一覧の取得に失敗しました");
  const data = await res.json();
  const result = z.array(FlightPlanDtoSchema).safeParse(data.plans);
  if (!result.success) {
    throw new Error("飛行計画一覧の取得に失敗しました: レスポンスの形式が不正です");
  }
  return result.data;
}

export async function fetchFlightPlan(id: string): Promise<FlightPlanDto> {
  const res = await fetch(`/api/flight/plans/${id}`);
  if (!res.ok) await throwOnError(res, "飛行計画の取得に失敗しました");
  const data = await res.json();
  return parsePlanDto(data.plan, "飛行計画の取得に失敗しました");
}

export async function createFlightPlan(input: FlightPlanFormData): Promise<FlightPlanDto> {
  const res = await fetch("/api/flight/plans", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) await throwOnError(res, "飛行計画の作成に失敗しました");
  const data = await res.json();
  return parsePlanDto(data.plan, "飛行計画の作成に失敗しました");
}

export async function updateFlightPlanStatus(
  id: string,
  status: FlightPlanStatus,
): Promise<FlightPlanDto> {
  const res = await fetch(`/api/flight/plans/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status }),
  });
  if (!res.ok) await throwOnError(res, "ステータスの更新に失敗しました");
  const data = await res.json();
  return parsePlanDto(data.plan, "ステータスの更新に失敗しました");
}
