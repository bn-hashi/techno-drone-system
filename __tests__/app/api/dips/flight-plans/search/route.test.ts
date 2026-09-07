// @vitest-environment node
import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextResponse } from "next/server";
import {
  DipsDisabledError,
  DipsConfigError,
  DipsAuthError,
  DipsApiError,
  DipsAuthRequiredError,
} from "@/lib/dips/errors";

vi.mock("@/lib/auth/requireFlightAccess", () => ({
  requireFlightAccess: vi.fn(),
}));
vi.mock("@/lib/serviceFactory", () => ({
  getDipsService: vi.fn(),
}));

import { requireFlightAccess } from "@/lib/auth/requireFlightAccess";
import { getDipsService } from "@/lib/serviceFactory";
import { POST } from "@/app/api/dips/flight-plans/search/route";

const mockSearchFlightPlans = vi.fn();

const authorized = { ok: true as const, userId: "user-1", isAdmin: false };

const validBody = {
  centerLongitude: 139.4677,
  centerLatitude: 35.6476,
  radiusMeters: 10000,
};

function makeRequest(body: unknown): Request {
  return new Request("http://localhost/api/dips/flight-plans/search", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getDipsService).mockReturnValue({
    searchFlightPlans: mockSearchFlightPlans,
  } as unknown as ReturnType<typeof getDipsService>);
});

describe("POST /api/dips/flight-plans/search", () => {
  it("test_post_returns_401_when_not_authenticated", async () => {
    vi.mocked(requireFlightAccess).mockResolvedValue({
      ok: false,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    });

    const response = await POST(makeRequest(validBody));

    expect(response.status).toBe(401);
  });

  it("test_post_returns_403_when_role_has_no_flight_access", async () => {
    vi.mocked(requireFlightAccess).mockResolvedValue({
      ok: false,
      response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    });

    const response = await POST(makeRequest(validBody));

    expect(response.status).toBe(403);
  });

  it("test_post_returns_400_when_body_is_not_valid_json", async () => {
    vi.mocked(requireFlightAccess).mockResolvedValue(authorized);
    const request = new Request("http://localhost/x", { method: "POST", body: "not json" });

    const response = await POST(request);

    expect(response.status).toBe(400);
  });

  it("test_post_returns_400_when_radius_is_not_positive", async () => {
    vi.mocked(requireFlightAccess).mockResolvedValue(authorized);

    const response = await POST(makeRequest({ ...validBody, radiusMeters: 0 }));

    expect(response.status).toBe(400);
  });

  it("test_post_accepts_body_without_only_mine_flag", async () => {
    vi.mocked(requireFlightAccess).mockResolvedValue(authorized);
    mockSearchFlightPlans.mockResolvedValue({ flightPlans: [], excludedCount: 0 });

    const response = await POST(makeRequest(validBody));

    expect(response.status).toBe(200);
  });

  it("test_post_returns_503_when_dips_is_disabled", async () => {
    vi.mocked(requireFlightAccess).mockResolvedValue(authorized);
    vi.mocked(getDipsService).mockImplementation(() => {
      throw new DipsDisabledError();
    });

    const response = await POST(makeRequest(validBody));

    expect(response.status).toBe(503);
  });

  it("test_post_returns_401_with_auth_required_flag_and_fpl_realm_when_token_missing", async () => {
    vi.mocked(requireFlightAccess).mockResolvedValue(authorized);
    mockSearchFlightPlans.mockRejectedValue(new DipsAuthRequiredError("fpl"));

    const response = await POST(makeRequest(validBody));
    const body = await response.json();

    expect({ status: response.status, authRequired: body.authRequired, realm: body.realm }).toEqual(
      { status: 401, authRequired: true, realm: "fpl" }
    );
  });

  it("test_post_returns_502_on_dips_api_error", async () => {
    vi.mocked(requireFlightAccess).mockResolvedValue(authorized);
    mockSearchFlightPlans.mockRejectedValue(new DipsApiError("failed"));

    const response = await POST(makeRequest(validBody));

    expect(response.status).toBe(502);
  });

  it("test_post_returns_503_on_dips_config_error", async () => {
    vi.mocked(requireFlightAccess).mockResolvedValue(authorized);
    mockSearchFlightPlans.mockRejectedValue(new DipsConfigError(["DIPS_FPL_CLIENT_ID"]));

    const response = await POST(makeRequest(validBody));

    expect(response.status).toBe(503);
  });

  it("test_post_returns_502_on_dips_auth_error", async () => {
    vi.mocked(requireFlightAccess).mockResolvedValue(authorized);
    mockSearchFlightPlans.mockRejectedValue(new DipsAuthError("failed"));

    const response = await POST(makeRequest(validBody));

    expect(response.status).toBe(502);
  });

  it("test_post_returns_500_on_unexpected_error", async () => {
    vi.mocked(requireFlightAccess).mockResolvedValue(authorized);
    mockSearchFlightPlans.mockRejectedValue(new Error("unexpected"));

    const response = await POST(makeRequest(validBody));

    expect(response.status).toBe(500);
  });

  it("test_post_returns_200_with_flight_plans_and_excluded_count", async () => {
    vi.mocked(requireFlightAccess).mockResolvedValue(authorized);
    mockSearchFlightPlans.mockResolvedValue({
      flightPlans: [{ flightPlanId: "PLAN-1" }],
      excludedCount: 2,
    });

    const response = await POST(makeRequest(validBody));
    const body = await response.json();

    expect({
      status: response.status,
      flightPlans: body.flightPlans,
      excludedCount: body.excludedCount,
    }).toEqual({ status: 200, flightPlans: [{ flightPlanId: "PLAN-1" }], excludedCount: 2 });
  });

  it("test_post_passes_authenticated_user_id_and_parsed_input_to_service", async () => {
    vi.mocked(requireFlightAccess).mockResolvedValue(authorized);
    mockSearchFlightPlans.mockResolvedValue({ flightPlans: [], excludedCount: 0 });

    await POST(makeRequest(validBody));

    expect(mockSearchFlightPlans).toHaveBeenCalledWith("user-1", validBody);
  });
});
