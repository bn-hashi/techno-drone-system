// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import { DipsApiClient } from "@/lib/dips/dipsApiClient";
import type { DipsOidcClient } from "@/lib/dips/oidcClient";
import type { DipsConfig } from "@/lib/dips/config";
import type { DipsFlightPlanNotificationPayload } from "@/lib/dips/types";

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

  it("test_fetchPermissions_returns_parsed_body", async () => {
    const body = { permissions: [{ permissionNumber: "東空運航123" }] };
    fetchMock.mockResolvedValue(jsonResponse(body));

    const result = await makeClient().fetchPermissions("user-1");

    expect(result).toEqual(body);
  });

  // ─── notifyFlightPlan (fpl realm / fpr base) ─────────────────────────────────

  it("test_notifyFlightPlan_requests_fpr_register_url_with_post", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ flightPlanId: "FP-1" }));

    await makeClient().notifyFlightPlan("user-1", samplePayload);

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://fpr-api.dips.example.test/api/flight-plan/register");
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
