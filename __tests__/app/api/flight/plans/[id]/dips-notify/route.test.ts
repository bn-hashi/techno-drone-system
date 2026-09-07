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
import type { DipsRealm } from "@/lib/dips/config";
import { FlightPlanNotFoundError, AircraftNotFoundError, BusinessError } from "@/services/errors";

vi.mock("@/lib/auth/requireFlightAccess", () => ({
  requireFlightAccess: vi.fn(),
}));
vi.mock("@/lib/serviceFactory", () => ({
  getDipsService: vi.fn(),
}));

import { requireFlightAccess } from "@/lib/auth/requireFlightAccess";
import { getDipsService } from "@/lib/serviceFactory";
import { POST } from "@/app/api/flight/plans/[id]/dips-notify/route";

const mockNotifyFlightPlan = vi.fn();

const authorized = { ok: true as const, userId: "user-1", isAdmin: false };

const validBody = {
  flightPurpose: [1],
  flightAirspace: [1],
  assistantsNumber: 0,
  departurePoint: "出発地",
  destinationPoint: "到着地",
  flightSpeed: 30,
  flightAltitude: 50,
  flyRoute: "テスト経路",
  riskMitigationOnsiteControl: true,
};

const makeRequest = (body: unknown = validBody) =>
  new Request("http://localhost/api/flight/plans/plan-1/dips-notify", {
    method: "POST",
    body: JSON.stringify(body),
  });

const makeContext = () => ({ params: { id: "plan-1" } });

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getDipsService).mockReturnValue({
    notifyFlightPlan: mockNotifyFlightPlan,
  } as unknown as ReturnType<typeof getDipsService>);
});

/**
 * `handleDipsRouteError` (`lib/dips/handleRouteError.ts`) への移行前は、このルートだけが
 * 独自の catch ブロックを持っていた (2026-09-02 差し戻し H2: 段階2共通化 (req-010) が
 * `app/api/dips/aircrafts/route.ts` と `app/api/dips/permissions/route.ts` の2箇所しか
 * 移行しておらず、飛行計画通報 (5-6) のコピーが移行漏れのまま残っていた)。
 * 独自コピーは分岐そのものも共通ハンドラと乖離していたため (DipsConfigError を502で返す・
 * realm を "fpl" にハードコード)、その2点を回帰テストとして固定する。
 */
describe("POST /api/flight/plans/[id]/dips-notify", () => {
  it("test_post_returns_401_when_not_authenticated", async () => {
    vi.mocked(requireFlightAccess).mockResolvedValue({
      ok: false,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    });

    const response = await POST(makeRequest(), makeContext());

    expect(response.status).toBe(401);
  });

  it("test_post_returns_400_when_body_is_invalid", async () => {
    vi.mocked(requireFlightAccess).mockResolvedValue(authorized);

    const response = await POST(makeRequest({}), makeContext());

    expect(response.status).toBe(400);
  });

  it("test_post_returns_200_with_result_on_success", async () => {
    vi.mocked(requireFlightAccess).mockResolvedValue(authorized);
    const result = {
      flightPlanId: "dips-1",
      flightPlanRegistrationResult: "OK",
      flightPlanRegistrationDatetime: "2026-09-02T00:00:00+09:00",
    };
    mockNotifyFlightPlan.mockResolvedValue(result);

    const response = await POST(makeRequest(), makeContext());
    const body = await response.json();

    expect({ status: response.status, result: body.result }).toEqual({
      status: 200,
      result,
    });
  });

  it("test_post_returns_503_when_dips_is_disabled", async () => {
    vi.mocked(requireFlightAccess).mockResolvedValue(authorized);
    mockNotifyFlightPlan.mockRejectedValue(new DipsDisabledError());

    const response = await POST(makeRequest(), makeContext());

    expect(response.status).toBe(503);
  });

  it("test_post_returns_401_with_auth_required_flag_and_realm_from_error", async () => {
    vi.mocked(requireFlightAccess).mockResolvedValue(authorized);
    mockNotifyFlightPlan.mockRejectedValue(new DipsAuthRequiredError("fpl"));

    const response = await POST(makeRequest(), makeContext());
    const body = await response.json();

    expect({ status: response.status, authRequired: body.authRequired, realm: body.realm }).toEqual({
      status: 401,
      authRequired: true,
      realm: "fpl",
    });
  });

  it("test_post_returns_realm_from_auth_required_error_not_hardcoded_fpl", async () => {
    // H2 回帰テスト: 以前はこのルートの catch ブロックが realm: "fpl" を決め打ちで返して
    // おり、DipsAuthRequiredError が実際に投げた realm を無視していた (機体情報一覧取得側で
    // 起きた D1 事故と同種)。意図的に異なる realm を投げ、レスポンスがそれをそのまま
    // 反映することを確認する (ハードコードなら "fpl" のまま失敗するはず)。
    // `as DipsRealm` は本テストの意図 (DipsRealm 以外の値でもハードコードされず素通りする
    // ことの確認) のためだけの型キャストで、2026-09-02 差し戻し H3 で
    // `DipsAuthRequiredError` の realm を `DipsRealm` に絞ったことに伴う
    vi.mocked(requireFlightAccess).mockResolvedValue(authorized);
    mockNotifyFlightPlan.mockRejectedValue(
      new DipsAuthRequiredError("fpl-drift-test" as DipsRealm)
    );

    const response = await POST(makeRequest(), makeContext());
    const body = await response.json();

    expect(body.realm).toBe("fpl-drift-test");
  });

  it("test_post_returns_404_when_flight_plan_not_found", async () => {
    vi.mocked(requireFlightAccess).mockResolvedValue(authorized);
    mockNotifyFlightPlan.mockRejectedValue(new FlightPlanNotFoundError("plan-1"));

    const response = await POST(makeRequest(), makeContext());

    expect(response.status).toBe(404);
  });

  it("test_post_returns_404_when_aircraft_not_found", async () => {
    vi.mocked(requireFlightAccess).mockResolvedValue(authorized);
    mockNotifyFlightPlan.mockRejectedValue(new AircraftNotFoundError("aircraft-1"));

    const response = await POST(makeRequest(), makeContext());

    expect(response.status).toBe(404);
  });

  it("test_post_returns_400_when_business_error_is_thrown", async () => {
    vi.mocked(requireFlightAccess).mockResolvedValue(authorized);
    mockNotifyFlightPlan.mockRejectedValue(new BusinessError("業務エラー"));

    const response = await POST(makeRequest(), makeContext());

    expect(response.status).toBe(400);
  });

  it("test_post_returns_503_and_config_message_for_dips_config_error", async () => {
    // H2 の本題: DipsConfigError (自システムの環境変数不足) は DIPS 側障害の502と混同すると
    // docs/production-operations-runbook.md の切り分け表 (503=自分の設定漏れ/502=DIPS側)
    // で運用者を誤誘導するため、他の /api/dips/* ルートと同じく503で返すこと
    vi.mocked(requireFlightAccess).mockResolvedValue(authorized);
    mockNotifyFlightPlan.mockRejectedValue(new DipsConfigError(["DIPS_FPL_CLIENT_ID"]));

    const response = await POST(makeRequest(), makeContext());
    const body = await response.json();

    expect({ status: response.status, error: body.error }).toEqual({
      status: 503,
      error: "DIPS連携の設定が不足しています",
    });
  });

  it("test_post_returns_502_for_dips_api_error", async () => {
    vi.mocked(requireFlightAccess).mockResolvedValue(authorized);
    mockNotifyFlightPlan.mockRejectedValue(new DipsApiError("failed"));

    const response = await POST(makeRequest(), makeContext());

    expect(response.status).toBe(502);
  });

  it("test_post_returns_502_for_dips_auth_error", async () => {
    vi.mocked(requireFlightAccess).mockResolvedValue(authorized);
    mockNotifyFlightPlan.mockRejectedValue(new DipsAuthError("failed"));

    const response = await POST(makeRequest(), makeContext());

    expect(response.status).toBe(502);
  });

  it("test_post_returns_500_for_unexpected_error", async () => {
    vi.mocked(requireFlightAccess).mockResolvedValue(authorized);
    mockNotifyFlightPlan.mockRejectedValue(new Error("unexpected"));

    const response = await POST(makeRequest(), makeContext());

    expect(response.status).toBe(500);
  });
});
