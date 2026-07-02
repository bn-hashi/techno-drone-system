import { describe, it, expect, vi, beforeEach } from "vitest";
import { DipsApiClient } from "@/lib/dips/dipsApiClient";
import type { DipsOidcClient } from "@/lib/dips/oidcClient";
import type { DipsConfig } from "@/lib/dips/config";

const config: DipsConfig = {
  baseUrl: "https://dips.example.test",
  tokenUrl: "https://dips.example.test/token",
  credentials: {
    aircraft: { clientId: "utm-app-test", clientSecret: "utm-secret" },
    permission: { clientId: "req-app-test", clientSecret: "req-secret" },
    flightPlan: { clientId: "fpl-app-test", clientSecret: "fpl-secret" },
  },
  applicantIds: {
    permissionGet: "USR063011",
    permissionApply: "USR063021",
    flightPlanGet: "USR063031",
    flightPlanNotify: "USR063041",
  },
};

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status });

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

  it("test_fetchAircraftList_requests_correct_url", async () => {
    fetchMock.mockResolvedValue(jsonResponse([]));

    await makeClient().fetchAircraftList();

    const [url] = fetchMock.mock.calls[0];
    expect(url).toBe("https://dips.example.test/api/v1/aircrafts");
  });

  it("test_fetchAircraftList_sends_bearer_token", async () => {
    fetchMock.mockResolvedValue(jsonResponse([]));

    await makeClient().fetchAircraftList();

    const [, init] = fetchMock.mock.calls[0];
    expect(init.headers.authorization).toBe("Bearer test-token");
  });

  it("test_fetchAircraftList_requests_token_for_aircraft_group", async () => {
    fetchMock.mockResolvedValue(jsonResponse([]));

    await makeClient().fetchAircraftList();

    expect(oidcClient.getAccessToken).toHaveBeenCalledWith("aircraft");
  });

  it("test_fetchAircraftList_returns_parsed_body", async () => {
    const aircrafts = [{ regSymbol: "JU1234567890" }];
    fetchMock.mockResolvedValue(jsonResponse(aircrafts));

    const result = await makeClient().fetchAircraftList();

    expect(result).toEqual(aircrafts);
  });

  it("test_fetchPermissions_appends_applicant_id_query", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ permissions: [] }));

    await makeClient().fetchPermissions();

    const [url] = fetchMock.mock.calls[0];
    expect(url).toContain("applicantId=USR063011");
  });

  it("test_fetchPermissions_requests_token_for_permission_group", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ permissions: [] }));

    await makeClient().fetchPermissions();

    expect(oidcClient.getAccessToken).toHaveBeenCalledWith("permission");
  });

  it("test_notifyFlightPlan_requests_correct_url_and_method", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ receptionNumber: "P250700001" }));

    await makeClient().notifyFlightPlan({
      flightStartDatetime: "2026-07-03T01:00:00.000Z",
      flightEndDatetime: "2026-07-03T02:00:00.000Z",
      flightPurpose: "訓練",
      flightLocation: "東京都港区",
      regSymbol: "JU1234567890",
    });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://dips.example.test/api/v1/flight-plan-notifications");
    expect(init.method).toBe("POST");
  });

  it("test_notifyFlightPlan_includes_applicant_id_in_body", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ receptionNumber: "P250700001" }));

    await makeClient().notifyFlightPlan({
      flightStartDatetime: "2026-07-03T01:00:00.000Z",
      flightEndDatetime: "2026-07-03T02:00:00.000Z",
      flightPurpose: "訓練",
      flightLocation: "東京都港区",
      regSymbol: "JU1234567890",
    });

    const [, init] = fetchMock.mock.calls[0];
    expect(JSON.parse(init.body).applicantId).toBe("USR063041");
  });

  it("test_notifyFlightPlan_returns_parsed_result", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ receptionNumber: "P250700001" }));

    const result = await makeClient().notifyFlightPlan({
      flightStartDatetime: "2026-07-03T01:00:00.000Z",
      flightEndDatetime: "2026-07-03T02:00:00.000Z",
      flightPurpose: "訓練",
      flightLocation: "東京都港区",
      regSymbol: "JU1234567890",
    });

    expect(result).toEqual({ receptionNumber: "P250700001" });
  });

  it("test_notifyFlightPlan_requests_token_for_flightPlan_group", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ receptionNumber: "P250700001" }));

    await makeClient().notifyFlightPlan({
      flightStartDatetime: "2026-07-03T01:00:00.000Z",
      flightEndDatetime: "2026-07-03T02:00:00.000Z",
      flightPurpose: "訓練",
      flightLocation: "東京都港区",
      regSymbol: "JU1234567890",
    });

    expect(oidcClient.getAccessToken).toHaveBeenCalledWith("flightPlan");
  });

  it("test_request_throws_DipsApiError_with_status_on_http_error", async () => {
    fetchMock.mockResolvedValue(new Response("forbidden", { status: 403 }));

    await expect(makeClient().fetchAircraftList()).rejects.toMatchObject({
      name: "DipsApiError",
      status: 403,
    });
  });

  it("test_request_error_includes_response_body", async () => {
    fetchMock.mockResolvedValue(new Response("detail message", { status: 500 }));

    await expect(makeClient().fetchNoFlyAreas()).rejects.toMatchObject({
      responseBody: "detail message",
    });
    expect.assertions(1);
  });

  it("test_request_wraps_network_failure_in_DipsApiError", async () => {
    fetchMock.mockRejectedValue(new TypeError("fetch failed"));

    await expect(makeClient().fetchAircraftList()).rejects.toMatchObject({
      name: "DipsApiError",
    });
  });

  it("test_request_wraps_malformed_json_response_in_DipsApiError", async () => {
    fetchMock.mockResolvedValue(new Response("not json", { status: 200 }));

    await expect(makeClient().fetchAircraftList()).rejects.toMatchObject({
      name: "DipsApiError",
    });
  });

  it("test_submitPermissionApplication_includes_applicant_id_in_body", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ ok: true }));

    await makeClient().submitPermissionApplication({ destination: "東京航空局" });

    const [, init] = fetchMock.mock.calls[0];
    const body = JSON.parse(init.body);
    expect(body.applicantId).toBe("USR063021");
  });

  it("test_submitPermissionApplication_preserves_payload_fields", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ ok: true }));

    await makeClient().submitPermissionApplication({ destination: "東京航空局" });

    const [, init] = fetchMock.mock.calls[0];
    const body = JSON.parse(init.body);
    expect(body.destination).toBe("東京航空局");
  });

  it("test_submitPermissionApplication_does_not_let_payload_override_applicant_id", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ ok: true }));

    await makeClient().submitPermissionApplication({ applicantId: "SPOOFED" });

    const [, init] = fetchMock.mock.calls[0];
    const body = JSON.parse(init.body);
    expect(body.applicantId).toBe("USR063021");
  });
});
