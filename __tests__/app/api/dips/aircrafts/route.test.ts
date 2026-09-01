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
import { GET } from "@/app/api/dips/aircrafts/route";

const mockListOwnedAircrafts = vi.fn();

const authorized = { ok: true as const, userId: "user-1", isAdmin: false };

const makeRequest = (query = "") =>
  new Request(`http://localhost/api/dips/aircrafts${query}`);

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getDipsService).mockReturnValue({
    listOwnedAircrafts: mockListOwnedAircrafts,
  } as unknown as ReturnType<typeof getDipsService>);
});

describe("GET /api/dips/aircrafts", () => {
  it("test_get_returns_401_when_not_authenticated", async () => {
    vi.mocked(requireFlightAccess).mockResolvedValue({
      ok: false,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    });

    const response = await GET(makeRequest());

    expect(response.status).toBe(401);
  });

  it("test_get_returns_403_when_role_has_no_flight_access", async () => {
    vi.mocked(requireFlightAccess).mockResolvedValue({
      ok: false,
      response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    });

    const response = await GET(makeRequest());

    expect(response.status).toBe(403);
  });

  it("test_get_returns_503_when_dips_is_disabled", async () => {
    vi.mocked(requireFlightAccess).mockResolvedValue(authorized);
    vi.mocked(getDipsService).mockImplementation(() => {
      throw new DipsDisabledError();
    });

    const response = await GET(makeRequest());

    expect(response.status).toBe(503);
  });

  it("test_get_returns_401_with_auth_required_flag_when_token_missing", async () => {
    vi.mocked(requireFlightAccess).mockResolvedValue(authorized);
    mockListOwnedAircrafts.mockRejectedValue(new DipsAuthRequiredError("utm"));

    const response = await GET(makeRequest());
    const body = await response.json();

    expect({ status: response.status, authRequired: body.authRequired, realm: body.realm }).toEqual(
      { status: 401, authRequired: true, realm: "utm" }
    );
  });

  it("test_get_returns_realm_from_auth_required_error_not_hardcoded", async () => {
    // D1 差し戻し (段階2共通化での回帰テスト): 以前はこのルートだけ realm: "utm" を
    // ハードコードしており、DipsAuthRequiredError が実際に渡した realm を無視していた
    // (ずれると無限ログインループになる)。許可・承認情報取得側 (req-009) は既に
    // 修正済みだったが、機体情報一覧取得側は素通りしていた事故の再発防止 (req-010)。
    // ここでは意図的に異なる realm を投げ、レスポンスがそれをそのまま反映することを
    // 確認する (ハードコードなら "utm" のまま失敗するはず)
    vi.mocked(requireFlightAccess).mockResolvedValue(authorized);
    mockListOwnedAircrafts.mockRejectedValue(new DipsAuthRequiredError("utm-drift-test"));

    const response = await GET(makeRequest());
    const body = await response.json();

    expect(body.realm).toBe("utm-drift-test");
  });

  it("test_get_returns_502_on_dips_api_error", async () => {
    vi.mocked(requireFlightAccess).mockResolvedValue(authorized);
    mockListOwnedAircrafts.mockRejectedValue(new DipsApiError("failed"));

    const response = await GET(makeRequest());

    expect(response.status).toBe(502);
  });

  it("test_get_returns_503_on_dips_config_error", async () => {
    // 回帰テスト (C1): 自システムの設定不足 (DipsConfigError) は DIPS 側障害の 502 と
    // 区別し、503 として返す (運用の切り分け表と整合させる)
    vi.mocked(requireFlightAccess).mockResolvedValue(authorized);
    mockListOwnedAircrafts.mockRejectedValue(new DipsConfigError(["DIPS_UTM_CLIENT_ID"]));

    const response = await GET(makeRequest());

    expect(response.status).toBe(503);
  });

  it("test_get_returns_502_on_dips_auth_error", async () => {
    vi.mocked(requireFlightAccess).mockResolvedValue(authorized);
    mockListOwnedAircrafts.mockRejectedValue(new DipsAuthError("failed"));

    const response = await GET(makeRequest());

    expect(response.status).toBe(502);
  });

  it("test_get_returns_200_with_aircrafts", async () => {
    vi.mocked(requireFlightAccess).mockResolvedValue(authorized);
    mockListOwnedAircrafts.mockResolvedValue({
      aircrafts: [{ registrationCode: "DUMMY0000001" }],
      excludedCount: 0,
    });

    const response = await GET(makeRequest());
    const body = await response.json();

    expect({ status: response.status, aircrafts: body.aircrafts }).toEqual({
      status: 200,
      aircrafts: [{ registrationCode: "DUMMY0000001" }],
    });
  });

  it("test_get_returns_200_with_excluded_count", async () => {
    // C3 回帰テスト: パースに失敗して除外された機体の件数を UI まで伝搬させる
    vi.mocked(requireFlightAccess).mockResolvedValue(authorized);
    mockListOwnedAircrafts.mockResolvedValue({
      aircrafts: [{ registrationCode: "DUMMY0000001" }],
      excludedCount: 2,
    });

    const response = await GET(makeRequest());
    const body = await response.json();

    expect(body.excludedCount).toBe(2);
  });

  it("test_get_passes_include_invalid_query_to_service", async () => {
    vi.mocked(requireFlightAccess).mockResolvedValue(authorized);
    mockListOwnedAircrafts.mockResolvedValue({ aircrafts: [], excludedCount: 0 });

    await GET(makeRequest("?includeInvalid=true"));

    expect(mockListOwnedAircrafts).toHaveBeenCalledWith("user-1", { includeInvalid: true });
  });

  it("test_get_defaults_include_invalid_to_false", async () => {
    vi.mocked(requireFlightAccess).mockResolvedValue(authorized);
    mockListOwnedAircrafts.mockResolvedValue({ aircrafts: [], excludedCount: 0 });

    await GET(makeRequest());

    expect(mockListOwnedAircrafts).toHaveBeenCalledWith("user-1", { includeInvalid: false });
  });
});
