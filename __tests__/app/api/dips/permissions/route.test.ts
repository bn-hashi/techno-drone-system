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
import { GET } from "@/app/api/dips/permissions/route";

const mockFetchPermissions = vi.fn();

const authorized = { ok: true as const, userId: "user-1", isAdmin: false };

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getDipsService).mockReturnValue({
    fetchPermissions: mockFetchPermissions,
  } as unknown as ReturnType<typeof getDipsService>);
});

describe("GET /api/dips/permissions", () => {
  it("test_get_returns_401_when_not_authenticated", async () => {
    vi.mocked(requireFlightAccess).mockResolvedValue({
      ok: false,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    });

    const response = await GET();

    expect(response.status).toBe(401);
  });

  it("test_get_returns_403_when_role_has_no_flight_access", async () => {
    vi.mocked(requireFlightAccess).mockResolvedValue({
      ok: false,
      response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    });

    const response = await GET();

    expect(response.status).toBe(403);
  });

  it("test_get_returns_503_when_dips_is_disabled", async () => {
    vi.mocked(requireFlightAccess).mockResolvedValue(authorized);
    vi.mocked(getDipsService).mockImplementation(() => {
      throw new DipsDisabledError();
    });

    const response = await GET();

    expect(response.status).toBe(503);
  });

  it("test_get_returns_401_with_auth_required_flag_and_req_realm_when_token_missing", async () => {
    // realm は req (機体情報一覧取得の utm とは別 realm)
    vi.mocked(requireFlightAccess).mockResolvedValue(authorized);
    mockFetchPermissions.mockRejectedValue(new DipsAuthRequiredError("req"));

    const response = await GET();
    const body = await response.json();

    expect({ status: response.status, authRequired: body.authRequired, realm: body.realm }).toEqual(
      { status: 401, authRequired: true, realm: "req" }
    );
  });

  it("test_get_returns_502_on_dips_api_error", async () => {
    vi.mocked(requireFlightAccess).mockResolvedValue(authorized);
    mockFetchPermissions.mockRejectedValue(new DipsApiError("failed"));

    const response = await GET();

    expect(response.status).toBe(502);
  });

  it("test_get_returns_503_on_dips_config_error", async () => {
    // 自システムの設定不足 (DipsConfigError) は DIPS 側障害の 502 と区別し、503 として返す
    // (機体情報一覧取得 API の C1 対応と同じ切り分け)
    vi.mocked(requireFlightAccess).mockResolvedValue(authorized);
    mockFetchPermissions.mockRejectedValue(new DipsConfigError(["DIPS_REQ_CLIENT_ID"]));

    const response = await GET();

    expect(response.status).toBe(503);
  });

  it("test_get_returns_502_on_dips_auth_error", async () => {
    vi.mocked(requireFlightAccess).mockResolvedValue(authorized);
    mockFetchPermissions.mockRejectedValue(new DipsAuthError("failed"));

    const response = await GET();

    expect(response.status).toBe(502);
  });

  it("test_get_returns_500_on_unexpected_error", async () => {
    vi.mocked(requireFlightAccess).mockResolvedValue(authorized);
    mockFetchPermissions.mockRejectedValue(new Error("unexpected"));

    const response = await GET();

    expect(response.status).toBe(500);
  });

  it("test_get_returns_200_with_permissions", async () => {
    vi.mocked(requireFlightAccess).mockResolvedValue(authorized);
    mockFetchPermissions.mockResolvedValue({
      permissions: [{ receptionNumber: "P000000001" }],
      excludedCount: 0,
    });

    const response = await GET();
    const body = await response.json();

    expect({ status: response.status, permissions: body.permissions }).toEqual({
      status: 200,
      permissions: [{ receptionNumber: "P000000001" }],
    });
  });

  it("test_get_returns_200_with_excluded_count", async () => {
    vi.mocked(requireFlightAccess).mockResolvedValue(authorized);
    mockFetchPermissions.mockResolvedValue({
      permissions: [{ receptionNumber: "P000000001" }],
      excludedCount: 2,
    });

    const response = await GET();
    const body = await response.json();

    expect(body.excludedCount).toBe(2);
  });

  it("test_get_passes_authenticated_user_id_to_service", async () => {
    vi.mocked(requireFlightAccess).mockResolvedValue(authorized);
    mockFetchPermissions.mockResolvedValue({ permissions: [], excludedCount: 0 });

    await GET();

    expect(mockFetchPermissions).toHaveBeenCalledWith("user-1");
  });
});
