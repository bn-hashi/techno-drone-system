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
import { POST } from "@/app/api/dips/flight-prohibited-areas/search/route";

const mockSearchFlightProhibitedAreas = vi.fn();

const authorized = { ok: true as const, userId: "user-1", isAdmin: false };

const validBody = {
  centerLongitude: 139.7686,
  centerLatitude: 35.6803,
  radiusMeters: 1000,
  flightProhibitedAreaTypeIds: [5, 6],
};

function makeRequest(body: unknown): Request {
  return new Request("http://localhost/api/dips/flight-prohibited-areas/search", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getDipsService).mockReturnValue({
    searchFlightProhibitedAreas: mockSearchFlightProhibitedAreas,
  } as unknown as ReturnType<typeof getDipsService>);
});

describe("POST /api/dips/flight-prohibited-areas/search", () => {
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

  it("test_post_returns_400_when_area_type_ids_is_empty", async () => {
    vi.mocked(requireFlightAccess).mockResolvedValue(authorized);

    const response = await POST(makeRequest({ ...validBody, flightProhibitedAreaTypeIds: [] }));

    expect(response.status).toBe(400);
  });

  it("test_post_returns_400_when_longitude_out_of_range", async () => {
    vi.mocked(requireFlightAccess).mockResolvedValue(authorized);

    const response = await POST(makeRequest({ ...validBody, centerLongitude: 200 }));

    expect(response.status).toBe(400);
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
    mockSearchFlightProhibitedAreas.mockRejectedValue(new DipsAuthRequiredError("fpl"));

    const response = await POST(makeRequest(validBody));
    const body = await response.json();

    expect({ status: response.status, authRequired: body.authRequired, realm: body.realm }).toEqual(
      { status: 401, authRequired: true, realm: "fpl" }
    );
  });

  it("test_post_returns_502_on_dips_api_error", async () => {
    vi.mocked(requireFlightAccess).mockResolvedValue(authorized);
    mockSearchFlightProhibitedAreas.mockRejectedValue(new DipsApiError("failed"));

    const response = await POST(makeRequest(validBody));

    expect(response.status).toBe(502);
  });

  it("test_post_returns_503_on_dips_config_error", async () => {
    vi.mocked(requireFlightAccess).mockResolvedValue(authorized);
    mockSearchFlightProhibitedAreas.mockRejectedValue(new DipsConfigError(["DIPS_FPL_CLIENT_ID"]));

    const response = await POST(makeRequest(validBody));

    expect(response.status).toBe(503);
  });

  it("test_post_returns_502_on_dips_auth_error", async () => {
    vi.mocked(requireFlightAccess).mockResolvedValue(authorized);
    mockSearchFlightProhibitedAreas.mockRejectedValue(new DipsAuthError("failed"));

    const response = await POST(makeRequest(validBody));

    expect(response.status).toBe(502);
  });

  it("test_post_returns_500_on_unexpected_error", async () => {
    vi.mocked(requireFlightAccess).mockResolvedValue(authorized);
    mockSearchFlightProhibitedAreas.mockRejectedValue(new Error("unexpected"));

    const response = await POST(makeRequest(validBody));

    expect(response.status).toBe(500);
  });

  it("test_post_returns_200_with_areas_and_excluded_count", async () => {
    vi.mocked(requireFlightAccess).mockResolvedValue(authorized);
    mockSearchFlightProhibitedAreas.mockResolvedValue({
      areas: [{ areaId: "AREA-1" }],
      excludedCount: 2,
    });

    const response = await POST(makeRequest(validBody));
    const body = await response.json();

    expect({ status: response.status, areas: body.areas, excludedCount: body.excludedCount }).toEqual(
      { status: 200, areas: [{ areaId: "AREA-1" }], excludedCount: 2 }
    );
  });

  it("test_post_passes_authenticated_user_id_and_parsed_input_to_service", async () => {
    vi.mocked(requireFlightAccess).mockResolvedValue(authorized);
    mockSearchFlightProhibitedAreas.mockResolvedValue({ areas: [], excludedCount: 0 });

    await POST(makeRequest(validBody));

    expect(mockSearchFlightProhibitedAreas).toHaveBeenCalledWith("user-1", validBody);
  });
});
