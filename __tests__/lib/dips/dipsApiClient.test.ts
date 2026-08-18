// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import { DipsApiClient } from "@/lib/dips/dipsApiClient";
import type { DipsOidcClient } from "@/lib/dips/oidcClient";
import type { DipsConfig } from "@/lib/dips/config";
import type { DipsFlightPlanNotificationPayload } from "@/lib/dips/types";
import { DipsConfigError } from "@/lib/dips/errors";
import { accountAResponse } from "@/test-fixtures/dips/aircraftListFixtures";

const config: DipsConfig = {
  authBaseUrl: "https://auth.dips.example.test",
  fprApiBaseUrl: "https://fpr-api.dips.example.test",
  fpaApiBaseUrl: "https://fpa-api.dips.example.test",
  credentials: {
    fpl: { clientId: "fpl-app-test", clientSecret: "fpl-secret" },
    req: { clientId: "req-app-test", clientSecret: "req-secret" },
  },
  redirectUri: "https://app.example.test/redirect",
  tokenEncryptionKey: "0123456789abcdef".repeat(4),
};

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status });

const samplePayload: DipsFlightPlanNotificationPayload = {
  flightPlanInfo: {
    flightPlanId: "",
    name: "訓練飛行",
    flightPurpose: [15],
    flightAirspace: [1],
    assistantsNumber: 0,
    departurePoint: "泉岳寺",
    destinationPoint: "京急泉岳寺駅",
    startTime: "20260703 1000",
    plannedMaxTime: 20,
    plannedFlightTime: 60,
    flightSpeed: 30,
    flightAltitude: 50,
    flyRoute: "{}",
    riskMitigationOnsiteControl: "1",
    aircraftInfo: [{ symbol: "JU1234567890" }],
  },
};

/**
 * 許可・承認情報取得 API の生レスポンス1件分 (最小限の有効な形。設定通知書
 * R08-DRS-0005 別紙3 のレスポンスサンプルに準拠。値はすべてテスト用のダミー)。
 * 詳細なスキーマ境界のテストは __tests__/lib/dips/permissionsSchema.test.ts が担う。
 */
const validPermissionEntry = {
  permissionNumber: "東空運航TEST01",
  permissionNumber2: null,
  receptionNumber: "P000000001",
  permissionDate: "2026-01-01",
  permissionPeriodStart: "2026-01-01",
  permissionPeriodEnd: "2026-12-31",
  flightLocation: "テスト県テスト市",
  flightRoutes: [{ routeName: "テスト経路", routeLatlons: ["000000 0000000"] }],
  aboveDenselyInhabitedDistricts: true,
  moreThan150mAboveTheGround: false,
  aroundAirports: false,
  lessThan30m: false,
  overEventSites: false,
  nightOperation: false,
  beyondVisualLineOfSight: false,
  transportHazardousMaterials: false,
  dropObjects: false,
  uaInfos: [{ uaMaker: "テスト製造者", uaName: "テスト型式", regSymbol: "999999999999" }],
};

describe("DipsApiClient", () => {
  let oidcClient: DipsOidcClient;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    oidcClient = {
      getAccessToken: vi.fn().mockResolvedValue("test-token"),
    } as unknown as DipsOidcClient;
    fetchMock = vi.fn();
  });

  const makeClient = () =>
    new DipsApiClient(config, oidcClient, fetchMock as unknown as typeof fetch);

  // ─── fetchPermissions (req realm / fpa base) ─────────────────────────────────

  it("test_fetchPermissions_requests_fpa_permissions_url", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ permissions: [] }));

    await makeClient().fetchPermissions("user-1");

    const [url] = fetchMock.mock.calls[0];
    expect(url).toBe("https://fpa-api.dips.example.test/req-pub/api/v1/appliers/me/permissions");
  });

  it("test_fetchPermissions_uses_req_realm_token", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ permissions: [] }));

    await makeClient().fetchPermissions("user-1");

    expect(oidcClient.getAccessToken).toHaveBeenCalledWith("user-1", "req");
  });

  it("test_fetchPermissions_sends_bearer_token", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ permissions: [] }));

    await makeClient().fetchPermissions("user-1");

    const [, init] = fetchMock.mock.calls[0];
    expect(init.headers.authorization).toBe("Bearer test-token");
  });

  it("test_fetchPermissions_returns_normalized_permission_with_reception_number", async () => {
    // fetchPermissions は生レスポンスをそのまま返さず、fetchAircraftList と同様に
    // 境界 (lib/dips/permissionsSchema.ts) で検証・正規化してから返す
    // (詳細: __tests__/lib/dips/permissionsSchema.test.ts)
    fetchMock.mockResolvedValue(jsonResponse({ permissions: [validPermissionEntry] }));

    const result = await makeClient().fetchPermissions("user-1");

    expect(result.permissions[0].receptionNumber).toBe("P000000001");
  });

  it("test_fetchPermissions_reports_zero_excluded_when_all_entries_parse", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ permissions: [validPermissionEntry] }));

    const result = await makeClient().fetchPermissions("user-1");

    expect(result.excludedCount).toBe(0);
  });

  it("test_fetchPermissions_drops_only_the_invalid_entry_and_reports_excluded_count", async () => {
    const invalidEntry = { ...validPermissionEntry, receptionNumber: 12345 }; // string 期待
    fetchMock.mockResolvedValue(
      jsonResponse({ permissions: [validPermissionEntry, invalidEntry] })
    );

    const result = await makeClient().fetchPermissions("user-1");

    expect({
      receptionNumbers: result.permissions.map((p) => p.receptionNumber),
      excludedCount: result.excludedCount,
    }).toEqual({ receptionNumbers: ["P000000001"], excludedCount: 1 });
  });

  // ─── notifyFlightPlan (fpl realm / fpr base) ─────────────────────────────────

  it("test_notifyFlightPlan_requests_fpr_register_url", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ flightPlanId: "FP-1" }));

    await makeClient().notifyFlightPlan("user-1", samplePayload);

    const [url] = fetchMock.mock.calls[0];
    expect(url).toBe("https://fpr-api.dips.example.test/api/flight-plan/register");
  });

  it("test_notifyFlightPlan_uses_post_method", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ flightPlanId: "FP-1" }));

    await makeClient().notifyFlightPlan("user-1", samplePayload);

    const [, init] = fetchMock.mock.calls[0];
    expect(init.method).toBe("POST");
  });

  it("test_notifyFlightPlan_uses_fpl_realm_token", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ flightPlanId: "FP-1" }));

    await makeClient().notifyFlightPlan("user-1", samplePayload);

    expect(oidcClient.getAccessToken).toHaveBeenCalledWith("user-1", "fpl");
  });

  it("test_notifyFlightPlan_sends_payload_as_body", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ flightPlanId: "FP-1" }));

    await makeClient().notifyFlightPlan("user-1", samplePayload);

    const [, init] = fetchMock.mock.calls[0];
    expect(JSON.parse(init.body).flightPlanInfo.name).toBe("訓練飛行");
  });

  it("test_notifyFlightPlan_returns_parsed_result", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ flightPlanId: "FP-1", flightPlanRegistrationResult: "OK" })
    );

    const result = await makeClient().notifyFlightPlan("user-1", samplePayload);

    expect(result.flightPlanId).toBe("FP-1");
  });

  // ─── fetchAircraftList (utm realm / drs base) ────────────────────────────────

  const makeDrsClient = () => {
    const drsConfig: DipsConfig = { ...config, drsApiBaseUrl: "https://drs-api.dips.example.test" };
    return new DipsApiClient(drsConfig, oidcClient, fetchMock as unknown as typeof fetch);
  };

  it("test_fetchAircraftList_requests_drs_aircrafts_url", async () => {
    fetchMock.mockResolvedValue(jsonResponse(accountAResponse));

    await makeDrsClient().fetchAircraftList("user-1");

    const [url] = fetchMock.mock.calls[0];
    expect(url).toBe("https://drs-api.dips.example.test/utm/v1/aircrafts");
  });

  it("test_fetchAircraftList_uses_utm_realm_token", async () => {
    fetchMock.mockResolvedValue(jsonResponse(accountAResponse));

    await makeDrsClient().fetchAircraftList("user-1");

    expect(oidcClient.getAccessToken).toHaveBeenCalledWith("user-1", "utm");
  });

  it("test_fetchAircraftList_sends_bearer_token", async () => {
    fetchMock.mockResolvedValue(jsonResponse(accountAResponse));

    await makeDrsClient().fetchAircraftList("user-1");

    const [, init] = fetchMock.mock.calls[0];
    expect(init.headers.authorization).toBe("Bearer test-token");
  });

  it("test_fetchAircraftList_uses_get_method", async () => {
    fetchMock.mockResolvedValue(jsonResponse(accountAResponse));

    await makeDrsClient().fetchAircraftList("user-1");

    const [, init] = fetchMock.mock.calls[0];
    expect(init.method).toBe("GET");
  });

  it("test_fetchAircraftList_returns_all_normalized_aircrafts", async () => {
    fetchMock.mockResolvedValue(jsonResponse(accountAResponse));

    const result = await makeDrsClient().fetchAircraftList("user-1");

    expect(result.aircrafts).toHaveLength(9);
  });

  it("test_fetchAircraftList_normalized_aircraft_has_reg_symbol_property", async () => {
    fetchMock.mockResolvedValue(jsonResponse(accountAResponse));

    const result = await makeDrsClient().fetchAircraftList("user-1");

    expect(result.aircrafts[0]).toHaveProperty("regSymbol");
  });

  it("test_fetchAircraftList_reports_zero_excluded_when_all_entries_parse", async () => {
    fetchMock.mockResolvedValue(jsonResponse(accountAResponse));

    const result = await makeDrsClient().fetchAircraftList("user-1");

    expect(result.excludedCount).toBe(0);
  });

  it("test_fetchAircraftList_throws_api_error_on_non_200", async () => {
    fetchMock.mockResolvedValue(new Response("forbidden", { status: 403 }));

    await expect(makeDrsClient().fetchAircraftList("user-1")).rejects.toMatchObject({
      name: "DipsApiError",
      status: 403,
    });
  });

  it("test_fetchAircraftList_throws_api_error_on_invalid_json", async () => {
    fetchMock.mockResolvedValue(new Response("not json", { status: 200 }));

    await expect(makeDrsClient().fetchAircraftList("user-1")).rejects.toMatchObject({
      name: "DipsApiError",
    });
  });

  it("test_fetchAircraftList_throws_config_error_when_drs_base_url_missing", async () => {
    fetchMock.mockResolvedValue(jsonResponse(accountAResponse));

    // config (drsApiBaseUrl 未設定) をそのまま使うクライアント
    await expect(makeClient().fetchAircraftList("user-1")).rejects.toThrow(DipsConfigError);
  });

  // ─── エラーハンドリング ───────────────────────────────────────────────────────

  it("test_request_throws_DipsApiError_with_status_on_http_error", async () => {
    fetchMock.mockResolvedValue(new Response("forbidden", { status: 403 }));

    await expect(makeClient().fetchPermissions("user-1")).rejects.toMatchObject({
      name: "DipsApiError",
      status: 403,
    });
  });

  it("test_request_error_includes_response_body", async () => {
    fetchMock.mockResolvedValue(new Response("detail message", { status: 500 }));

    await expect(makeClient().fetchPermissions("user-1")).rejects.toMatchObject({
      responseBody: "detail message",
    });
  });

  it("test_request_wraps_network_failure_in_DipsApiError", async () => {
    fetchMock.mockRejectedValue(new TypeError("fetch failed"));

    await expect(makeClient().fetchPermissions("user-1")).rejects.toMatchObject({
      name: "DipsApiError",
    });
  });

  it("test_request_wraps_malformed_json_response_in_DipsApiError", async () => {
    fetchMock.mockResolvedValue(new Response("not json", { status: 200 }));

    await expect(makeClient().fetchPermissions("user-1")).rejects.toMatchObject({
      name: "DipsApiError",
    });
  });
});
