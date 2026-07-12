import { z } from "zod";
import { extractErrorMessage } from "@/lib/api/errorHelpers";
import type { FlightPlanStatus } from "@prisma/client";

export type { FlightPlanStatus };

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

export interface FlightPlanUpdateData {
  title: string;
  location: string;
  plannedAt: string;
  durationMin: number;
  purpose: string;
}

export interface PaginatedFlightPlanDto {
  plans: FlightPlanDto[];
  total: number;
  page: number;
  limit: number;
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

const PaginatedFlightPlanSchema = z.object({
  plans: z.array(FlightPlanDtoSchema),
  total: z.number(),
  page: z.number(),
  limit: z.number(),
});

function parsePlanDto(raw: unknown, context: string): FlightPlanDto {
  const result = FlightPlanDtoSchema.safeParse(raw);
  if (!result.success) {
    throw new Error(`${context}: レスポンスの形式が不正です`);
  }
  return result.data;
}

export async function fetchFlightPlans(
  pagination: { page?: number; limit?: number } = {}
): Promise<PaginatedFlightPlanDto> {
  const params = new URLSearchParams();
  if (pagination.page) params.set("page", String(pagination.page));
  if (pagination.limit) params.set("limit", String(pagination.limit));
  const query = params.toString();

  const res = await fetch(`/api/flight/plans${query ? `?${query}` : ""}`);
  if (!res.ok) await throwOnError(res, "飛行計画一覧の取得に失敗しました");
  const data = await parseJsonBody(res, "飛行計画一覧の取得に失敗しました");
  const result = PaginatedFlightPlanSchema.safeParse(data);
  if (!result.success) {
    throw new Error("飛行計画一覧の取得に失敗しました: レスポンスの形式が不正です");
  }
  return result.data;
}

export async function fetchFlightPlan(id: string): Promise<FlightPlanDto> {
  const res = await fetch(`/api/flight/plans/${id}`);
  if (!res.ok) await throwOnError(res, "飛行計画の取得に失敗しました");
  const data = await parseJsonBody(res, "飛行計画の取得に失敗しました");
  return parsePlanDto((data as { plan: unknown }).plan, "飛行計画の取得に失敗しました");
}

export async function createFlightPlan(input: FlightPlanFormData): Promise<FlightPlanDto> {
  const res = await fetch("/api/flight/plans", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) await throwOnError(res, "飛行計画の作成に失敗しました");
  const data = await parseJsonBody(res, "飛行計画の作成に失敗しました");
  return parsePlanDto((data as { plan: unknown }).plan, "飛行計画の作成に失敗しました");
}

export async function updateFlightPlan(
  id: string,
  input: FlightPlanUpdateData
): Promise<FlightPlanDto> {
  const res = await fetch(`/api/flight/plans/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) await throwOnError(res, "飛行計画の更新に失敗しました");
  const data = await parseJsonBody(res, "飛行計画の更新に失敗しました");
  return parsePlanDto((data as { plan: unknown }).plan, "飛行計画の更新に失敗しました");
}

export async function updateFlightPlanStatus(
  id: string,
  status: FlightPlanStatus
): Promise<FlightPlanDto> {
  const res = await fetch(`/api/flight/plans/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status }),
  });
  if (!res.ok) await throwOnError(res, "ステータスの更新に失敗しました");
  const data = await parseJsonBody(res, "ステータスの更新に失敗しました");
  return parsePlanDto((data as { plan: unknown }).plan, "ステータスの更新に失敗しました");
}
