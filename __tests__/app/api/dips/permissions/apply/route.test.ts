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
import { POST } from "@/app/api/dips/permissions/apply/route";

const mockApplyPermissionTest = vi.fn();

const authorized = { ok: true as const, userId: "user-1", isAdmin: false };

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getDipsService).mockReturnValue({
    applyPermissionTest: mockApplyPermissionTest,
  } as unknown as ReturnType<typeof getDipsService>);
});

describe("POST /api/dips/permissions/apply", () => {
  it("test_post_returns_401_when_not_authenticated", async () => {
    vi.mocked(requireFlightAccess).mockResolvedValue({
      ok: false,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    });

    const response = await POST();

    expect(response.status).toBe(401);
  });

  it("test_post_returns_403_when_role_has_no_flight_access", async () => {
    vi.mocked(requireFlightAccess).mockResolvedValue({
      ok: false,
      response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    });

    const response = await POST();

    expect(response.status).toBe(403);
  });

  it("test_post_returns_503_when_dips_is_disabled", async () => {
    vi.mocked(requireFlightAccess).mockResolvedValue(authorized);
    vi.mocked(getDipsService).mockImplementation(() => {
      throw new DipsDisabledError();
    });

    const response = await POST();

    expect(response.status).toBe(503);
  });

  it("test_post_returns_401_with_auth_required_flag_and_req_realm_when_token_missing", async () => {
    vi.mocked(requireFlightAccess).mockResolvedValue(authorized);
    mockApplyPermissionTest.mockRejectedValue(new DipsAuthRequiredError("req"));

    const response = await POST();
    const body = await response.json();

    expect({ status: response.status, authRequired: body.authRequired, realm: body.realm }).toEqual(
      { status: 401, authRequired: true, realm: "req" }
    );
  });

  it("test_post_returns_502_on_dips_api_error", async () => {
    // DIPS 自身の業務検証エラー (ガイドライン §2.3.7 の 401/error配列) もここに含まれる。
    // dipsApiClient.ts の request() は非 200 応答を一律 DipsApiError にするため、
    // 業務検証エラーと通信障害を区別せず 502 として扱う (5-1/5-2/5-6 と同じ設計)
    vi.mocked(requireFlightAccess).mockResolvedValue(authorized);
    mockApplyPermissionTest.mockRejectedValue(new DipsApiError("failed", 401));

    const response = await POST();

    expect(response.status).toBe(502);
  });

  it("test_post_returns_503_on_dips_config_error", async () => {
    vi.mocked(requireFlightAccess).mockResolvedValue(authorized);
    mockApplyPermissionTest.mockRejectedValue(new DipsConfigError(["DIPS_REQ_CLIENT_ID"]));

    const response = await POST();

    expect(response.status).toBe(503);
  });

  it("test_post_returns_502_on_dips_auth_error", async () => {
    vi.mocked(requireFlightAccess).mockResolvedValue(authorized);
    mockApplyPermissionTest.mockRejectedValue(new DipsAuthError("failed"));

    const response = await POST();

    expect(response.status).toBe(502);
  });

  it("test_post_returns_500_on_unexpected_error", async () => {
    vi.mocked(requireFlightAccess).mockResolvedValue(authorized);
    mockApplyPermissionTest.mockRejectedValue(new Error("unexpected"));

    const response = await POST();

    expect(response.status).toBe(500);
  });

  it("test_post_returns_200_with_form_num_on_success", async () => {
    vi.mocked(requireFlightAccess).mockResolvedValue(authorized);
    mockApplyPermissionTest.mockResolvedValue({ formNum: "Q190100001" });

    const response = await POST();
    const body = await response.json();

    expect({ status: response.status, result: body.result }).toEqual({
      status: 200,
      result: { formNum: "Q190100001" },
    });
  });

  it("test_post_passes_authenticated_user_id_to_service", async () => {
    vi.mocked(requireFlightAccess).mockResolvedValue(authorized);
    mockApplyPermissionTest.mockResolvedValue({ formNum: "Q190100001" });

    await POST();

    expect(mockApplyPermissionTest).toHaveBeenCalledWith("user-1");
  });
});
