import { describe, it, expect, beforeEach, vi } from "vitest";
import { FlightPlanStatus } from "@prisma/client";
import { FlightPlanNotFoundError, BusinessError } from "@/services/errors";

vi.mock("@/lib/auth/requireFlightAccess", () => ({
  requireFlightAccess: vi.fn(),
}));
vi.mock("@/lib/serviceFactory", () => ({
  getFlightPlanService: vi.fn(),
}));

import { requireFlightAccess } from "@/lib/auth/requireFlightAccess";
import { getFlightPlanService } from "@/lib/serviceFactory";
import { PUT } from "@/app/api/flight/plans/[id]/route";
import { NextResponse } from "next/server";

const mockUpdate = vi.fn();

const authorized = { ok: true as const, userId: "user-1", isAdmin: false };

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getFlightPlanService).mockReturnValue({
    update: mockUpdate,
  } as unknown as ReturnType<typeof getFlightPlanService>);
});

const makeContext = (id: string) => ({ params: { id } });

const makeRequest = (body: unknown) =>
  new Request("http://localhost/api/flight/plans/plan-1", {
    method: "PUT",
    body: JSON.stringify(body),
  });

const validBody = {
  title: "更新後タイトル",
  location: "大阪府",
  plannedAt: "2026-08-01T01:00:00.000Z",
  durationMin: 45,
  purpose: "更新後の目的",
};

describe("PUT /api/flight/plans/[id]", () => {
  it("test_PUT_unauthorized_returns_401_without_calling_service", async () => {
    vi.mocked(requireFlightAccess).mockResolvedValue({
      ok: false,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    });

    const response = await PUT(makeRequest(validBody), makeContext("plan-1"));

    expect(response.status).toBe(401);
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("test_PUT_invalid_body_returns_400", async () => {
    vi.mocked(requireFlightAccess).mockResolvedValue(authorized);

    const response = await PUT(makeRequest({ title: "" }), makeContext("plan-1"));

    expect(response.status).toBe(400);
  });

  it("test_PUT_invalid_body_does_not_call_service", async () => {
    vi.mocked(requireFlightAccess).mockResolvedValue(authorized);

    await PUT(makeRequest({ title: "" }), makeContext("plan-1"));

    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("test_PUT_valid_body_calls_service_update_with_parsed_plannedAt", async () => {
    vi.mocked(requireFlightAccess).mockResolvedValue(authorized);
    mockUpdate.mockResolvedValue({ id: "plan-1", status: FlightPlanStatus.DRAFT });

    await PUT(makeRequest(validBody), makeContext("plan-1"));

    expect(mockUpdate).toHaveBeenCalledWith(
      "plan-1",
      expect.objectContaining({
        title: "更新後タイトル",
        plannedAt: new Date(validBody.plannedAt),
      }),
      { userId: "user-1", isAdmin: false }
    );
  });

  it("test_PUT_success_returns_200_with_updated_plan", async () => {
    vi.mocked(requireFlightAccess).mockResolvedValue(authorized);
    const updatedPlan = { id: "plan-1", title: "更新後タイトル", status: FlightPlanStatus.DRAFT };
    mockUpdate.mockResolvedValue(updatedPlan);

    const response = await PUT(makeRequest(validBody), makeContext("plan-1"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ plan: updatedPlan });
  });

  it("test_PUT_not_found_returns_404", async () => {
    vi.mocked(requireFlightAccess).mockResolvedValue(authorized);
    mockUpdate.mockRejectedValue(new FlightPlanNotFoundError("plan-1"));

    const response = await PUT(makeRequest(validBody), makeContext("plan-1"));

    expect(response.status).toBe(404);
  });

  it("test_PUT_business_error_returns_400", async () => {
    vi.mocked(requireFlightAccess).mockResolvedValue(authorized);
    mockUpdate.mockRejectedValue(new BusinessError("飛行完了済みの計画は編集できません"));

    const response = await PUT(makeRequest(validBody), makeContext("plan-1"));

    expect(response.status).toBe(400);
  });

  it("test_PUT_unexpected_error_returns_500", async () => {
    vi.mocked(requireFlightAccess).mockResolvedValue(authorized);
    mockUpdate.mockRejectedValue(new Error("db down"));

    const response = await PUT(makeRequest(validBody), makeContext("plan-1"));

    expect(response.status).toBe(500);
  });
});
