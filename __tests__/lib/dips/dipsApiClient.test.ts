// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import { DipsApiClient } from "@/lib/dips/dipsApiClient";
import type { DipsOidcClient } from "@/lib/dips/oidcClient";
import type { DipsConfig } from "@/lib/dips/config";
import type { DipsFlightPlanNotificationPayload } from "@/lib/dips/types";
import { DipsConfigError, DipsPossiblyAcceptedTimeoutError } from "@/lib/dips/errors";
import { accountAResponse } from "@/test-fixtures/dips/aircraftListFixtures";
import { buildPermissionApplicationTestPayload } from "@/lib/dips/permissionApplicationSchema";

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

const sampleContactPerson = {
  name: "申請太郎",
  country: "001",
  prefectures: "13",
  municipality: "中央区銀座1-1",
  telephoneCountry: "001",
  telephone: "09011112222",
  email: "shinsei@example.test",
};

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
    riskMitigationOnsiteControlL3: "0",
    riskMitigationOnsiteControlL35: "0",
    riskMitigationOnsiteControl2: "0",
    exceptionalConditionsMooring: "0",
    reporter: {
      contactReporterFlag: "1",
      contactReporter: sampleContactPerson,
    },
    pilotInfo: [
      {
        contactPilotFlag: "0",
        contactPilot: sampleContactPerson,
        firstClass: "0",
        secondClass: "0",
        privateLicense: "0",
        maker: "maker001",
        model: "model001",
      },
    ],
    aircraftInfo: [
      {
        type: "2",
        symbol: "JU1234567890",
        model: "model001",
        maker: "maker001",
        certification1: "0",
        certification2: "0",
        maxWeight: 0.9,
      },
    ],
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

  // ─── searchFlightProhibitedAreas (fpl realm / fpr base) ──────────────────────

  const validAreaEntry = {
    flightProhibitedAreaId: "20221105_FISSikou0015",
    name: "東京国際空港 空港の区域",
    range: { type: "Polygon", coordinates: [[139.779031, 35.569748]], center: [], radius: 0 },
    detail: "小型無人機等飛行禁止法に基づく飛行禁止空域",
    url: "https://www.mlit.go.jp/koku/koku_tk2_000023.html",
    flightProhibitedAreaTypeId: 5,
    startTime: "2022-10-01T09:00:00",
    finishTime: "9999-12-31T23:59:00",
  };

  const sampleAreaSearchRequest = {
    features: { type: "Circle" as const, center: [139.7686, 35.6803] as [number, number], radius: 1000 },
    flightProhibitedAreaTypeIds: [5, 6],
  };

  it("test_searchFlightProhibitedAreas_requests_fpr_prohibited_area_search_url", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ flightProhibitedAreaInfo: [] }));

    await makeClient().searchFlightProhibitedAreas("user-1", sampleAreaSearchRequest);

    const [url] = fetchMock.mock.calls[0];
    expect(url).toBe("https://fpr-api.dips.example.test/api/flight-prohibited-area/search");
  });

  it("test_searchFlightProhibitedAreas_uses_fpl_realm_token", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ flightProhibitedAreaInfo: [] }));

    await makeClient().searchFlightProhibitedAreas("user-1", sampleAreaSearchRequest);

    expect(oidcClient.getAccessToken).toHaveBeenCalledWith("user-1", "fpl");
  });

  it("test_searchFlightProhibitedAreas_nests_area_type_ids_under_flightProhibitedAreaInfo", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ flightProhibitedAreaInfo: [] }));

    await makeClient().searchFlightProhibitedAreas("user-1", sampleAreaSearchRequest);

    const [, init] = fetchMock.mock.calls[0];
    const body = JSON.parse(init.body as string);
    expect(body).toEqual({
      features: sampleAreaSearchRequest.features,
      flightProhibitedAreaInfo: { flightProhibitedAreaTypeId: [5, 6] },
    });
  });

  it("test_searchFlightProhibitedAreas_returns_normalized_areas", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ flightProhibitedAreaInfo: [validAreaEntry] }));

    const result = await makeClient().searchFlightProhibitedAreas("user-1", sampleAreaSearchRequest);

    expect(result).toEqual({
      areas: [
        {
          areaId: "20221105_FISSikou0015",
          name: "東京国際空港 空港の区域",
          detail: "小型無人機等飛行禁止法に基づく飛行禁止空域",
          url: "https://www.mlit.go.jp/koku/koku_tk2_000023.html",
          areaTypeId: 5,
          startTime: "2022-10-01T09:00:00",
          finishTime: "9999-12-31T23:59:00",
          range: validAreaEntry.range,
        },
      ],
      excludedCount: 0,
    });
  });

  // ─── searchFlightPlans (fpl realm / fpr base) ────────────────────────────────

  const minimalFlightPlanEntry = {
    flightPlanId: "PLAN-1",
    startTime: "20261125 1130",
    finishTime: "20261125 1230",
    plannedMaxTime: 120,
    plannedFlightTime: 60,
    flightSpeed: 100,
    flightAltitude: 120,
    flyRoute: { type: "Circle", center: [139.4677, 35.6476], radius: 150 },
  };

  const sampleFlightPlanSearchRequest = {
    features: { type: "Circle" as const, center: [139.4677, 35.6476] as [number, number], radius: 10000 },
    allFlightPlan: "0" as const,
  };

  it("test_searchFlightPlans_requests_fpr_flight_plan_search_url", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ flightPlanInfo: [] }));

    await makeClient().searchFlightPlans("user-1", sampleFlightPlanSearchRequest);

    const [url] = fetchMock.mock.calls[0];
    expect(url).toBe("https://fpr-api.dips.example.test/api/flight-plan/search");
  });

  it("test_searchFlightPlans_uses_fpl_realm_token", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ flightPlanInfo: [] }));

    await makeClient().searchFlightPlans("user-1", sampleFlightPlanSearchRequest);

    expect(oidcClient.getAccessToken).toHaveBeenCalledWith("user-1", "fpl");
  });

  it("test_searchFlightPlans_sends_request_body_as_is_without_extra_nesting", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ flightPlanInfo: [] }));

    await makeClient().searchFlightPlans("user-1", sampleFlightPlanSearchRequest);

    const [, init] = fetchMock.mock.calls[0];
    expect(JSON.parse(init.body as string)).toEqual(sampleFlightPlanSearchRequest);
  });

  it("test_searchFlightPlans_returns_normalized_flight_plans", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ flightPlanInfo: [minimalFlightPlanEntry] }));

    const result = await makeClient().searchFlightPlans("user-1", sampleFlightPlanSearchRequest);

    expect(result.flightPlans[0].flightPlanId).toBe("PLAN-1");
    expect(result.excludedCount).toBe(0);
  });

  // ─── applyPermission (req realm / fpa base) ──────────────────────────────────

  const samplePermissionApplicationPayload = buildPermissionApplicationTestPayload(
    new Date("2026-09-02T00:00:00+09:00")
  );

  it("test_applyPermission_requests_fpa_permission_register_url", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ formNum: "Q190100001" }));

    await makeClient().applyPermission("user-1", samplePermissionApplicationPayload);

    const [url] = fetchMock.mock.calls[0];
    expect(url).toBe(
      "https://fpa-api.dips.example.test/req-pub/api/v1/appliers/me/permissionRegister"
    );
  });

  it("test_applyPermission_uses_req_realm_token", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ formNum: "Q190100001" }));

    await makeClient().applyPermission("user-1", samplePermissionApplicationPayload);

    expect(oidcClient.getAccessToken).toHaveBeenCalledWith("user-1", "req");
  });

  it("test_applyPermission_sends_payload_as_body", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ formNum: "Q190100001" }));

    await makeClient().applyPermission("user-1", samplePermissionApplicationPayload);

    const [, init] = fetchMock.mock.calls[0];
    expect(JSON.parse(init.body as string)).toEqual(samplePermissionApplicationPayload);
  });

  it("test_applyPermission_returns_parsed_form_num", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ formNum: "Q190100001" }));

    const result = await makeClient().applyPermission("user-1", samplePermissionApplicationPayload);

    expect(result).toEqual({ formNum: "Q190100001" });
  });

  it("test_applyPermission_throws_dips_api_error_when_form_num_missing", async () => {
    fetchMock.mockResolvedValue(jsonResponse({}));

    await expect(
      makeClient().applyPermission("user-1", samplePermissionApplicationPayload)
    ).rejects.toMatchObject({ name: "DipsApiError" });
  });

  // ─── notifyFlightPlan (fpl realm / fpr base) ─────────────────────────────────
  //
  // 2026-09-11 req-014 課題1: ガイドライン §2.3.8 の正常時レスポンスは「トップレベル配列
  // + flightPlanInfoRegistrationResult 入れ子」であり、以前の `{ flightPlanId: "FP-1" }`
  // というフラットなモックは実際の DIPS 応答と一致していなかった (このモックのままだと
  // 素キャストのバグ (result.flightPlanId が undefined になる) を検出できない)。
  // ガイドラインのレスポンスボディサンプル (samples.txt 326-337行) をそのまま使う。

  const guidelineNotifySuccessResponse = [
    {
      flightPlanInfoRegistrationResult: {
        flightPlanId: "AAAAAAAAAAAAAAAAAAA.FP20221205042709013.001",
        flightPlanRegistrationResult: "登録完了",
        flightPlanRegistrationDatetime: "2022/12/05 10:27",
        existOtherFlightRoutesCount: 0,
      },
    },
  ];

  it("test_notifyFlightPlan_requests_fpr_register_url", async () => {
    fetchMock.mockResolvedValue(jsonResponse(guidelineNotifySuccessResponse));

    await makeClient().notifyFlightPlan("user-1", samplePayload);

    const [url] = fetchMock.mock.calls[0];
    expect(url).toBe("https://fpr-api.dips.example.test/api/flight-plan/register");
  });

  it("test_notifyFlightPlan_uses_post_method", async () => {
    fetchMock.mockResolvedValue(jsonResponse(guidelineNotifySuccessResponse));

    await makeClient().notifyFlightPlan("user-1", samplePayload);

    const [, init] = fetchMock.mock.calls[0];
    expect(init.method).toBe("POST");
  });

  it("test_notifyFlightPlan_uses_fpl_realm_token", async () => {
    fetchMock.mockResolvedValue(jsonResponse(guidelineNotifySuccessResponse));

    await makeClient().notifyFlightPlan("user-1", samplePayload);

    expect(oidcClient.getAccessToken).toHaveBeenCalledWith("user-1", "fpl");
  });

  it("test_notifyFlightPlan_sends_payload_as_body", async () => {
    fetchMock.mockResolvedValue(jsonResponse(guidelineNotifySuccessResponse));

    await makeClient().notifyFlightPlan("user-1", samplePayload);

    const [, init] = fetchMock.mock.calls[0];
    expect(JSON.parse(init.body).flightPlanInfo.name).toBe("訓練飛行");
  });

  it("test_notifyFlightPlan_returns_flight_plan_id_from_the_nested_guideline_shape", async () => {
    // 2026-09-11 事故の再現・回帰テスト: これは修正前 (素キャスト) では失敗する
    // (result.flightPlanId が undefined になる)。実行結果は builder 報告書に貼ること
    fetchMock.mockResolvedValue(jsonResponse(guidelineNotifySuccessResponse));

    const result = await makeClient().notifyFlightPlan("user-1", samplePayload);

    expect(result.flightPlanId).toBe("AAAAAAAAAAAAAAAAAAA.FP20221205042709013.001");
  });

  it("test_notifyFlightPlan_returns_exist_other_flight_routes_count", async () => {
    fetchMock.mockResolvedValue(jsonResponse(guidelineNotifySuccessResponse));

    const result = await makeClient().notifyFlightPlan("user-1", samplePayload);

    expect(result.existOtherFlightRoutesCount).toBe(0);
  });

  it("test_notifyFlightPlan_throws_accepted_but_unreadable_error_when_response_is_flat_not_array", async () => {
    // 修正前の実装が想定していた (誤った) フラット形状は、修正後は
    // 「受理済みだが読み取れない」エラーとして扱われる (undefined を握りつぶさない)
    fetchMock.mockResolvedValue(jsonResponse({ flightPlanId: "FP-1" }));

    await expect(makeClient().notifyFlightPlan("user-1", samplePayload)).rejects.toMatchObject({
      name: "DipsAcceptedButUnreadableResultError",
    });
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

  it("test_request_error_truncates_response_body_to_200_chars_for_pii_safety", async () => {
    // handleDipsRouteError (2026-09-08 対応) が responseBody をログへ転記するようになった
    // ため、ここでの200文字切り詰め (RESPONSE_BODY_PREVIEW_LENGTH) が個人情報の露出を
    // 防ぐ唯一の歯止めになる。全 API (fetchPermissions 以外の5APIも同じ request() を経由)
    // で一律に適用されることを、この1本のテストで代表させる
    const longBody = "a".repeat(500);
    fetchMock.mockResolvedValue(new Response(longBody, { status: 500 }));

    const error = (await makeClient()
      .fetchPermissions("user-1")
      .catch((caught: unknown) => caught)) as { responseBody?: string };

    expect(error.responseBody).toHaveLength(200);
    expect(error.responseBody).toBe("a".repeat(200));
  });

  it("test_request_marks_error_as_safe_to_display_only_for_allowlisted_endpoints", async () => {
    // req 系 (許可・承認情報取得) は allowlist 対象外 (isErrorBodySafeToDisplay 省略 = false)
    fetchMock.mockResolvedValue(new Response("detail", { status: 500 }));

    const error = (await makeClient()
      .fetchPermissions("user-1")
      .catch((caught: unknown) => caught)) as { isErrorBodySafeToDisplay?: boolean };

    expect(error.isErrorBodySafeToDisplay).toBeUndefined();
  });

  it("test_request_extends_truncation_length_to_1000_chars_for_allowlisted_fpl_endpoints", async () => {
    // 2026-09-11 req-014 課題2 (人の決定 H-4): allowlist 済み (fpl系) のみ200→1000に
    // 引き上げる。長文エラー (必須項目不足の羅列等) が読めるようにするための変更
    const longBody = "a".repeat(1500);
    fetchMock.mockResolvedValue(new Response(longBody, { status: 400 }));

    const error = (await makeClient()
      .notifyFlightPlan("user-1", samplePayload)
      .catch((caught: unknown) => caught)) as { responseBody?: string; isErrorBodySafeToDisplay?: boolean };

    expect(error.responseBody).toHaveLength(1000);
    expect(error.isErrorBodySafeToDisplay).toBe(true);
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

  // ─── I1: 非冪等な登録系 POST のタイムアウト (2026-09-06 レビュー差し戻し) ─────────
  //
  // 134項目に及ぶ許可・承認申請登録 (applyPermission) や飛行計画通報 (notifyFlightPlan)
  // が10秒のタイムアウトで中断されると、DIPS 側では申請が受理済みの可能性があるにも
  // かかわらず「送信に失敗しました」としか伝わらず、運用者が再送して共用検証環境DBに
  // 重複登録する実害があった。以下は「壊れている状態」(修正前は両方失敗する) を再現する
  // 回帰テスト。

  it("test_applyPermission_requests_a_longer_timeout_than_read_requests", async () => {
    // 非冪等な登録系 POST (permissionRegister) は、冪等な GET/検索系より長いタイムアウトを
    // 取る必要がある。AbortSignal.timeout() に渡された値を検証する
    const timeoutSpy = vi.spyOn(AbortSignal, "timeout");
    fetchMock.mockResolvedValue(jsonResponse({ formNum: "Q190100001" }));

    await makeClient().applyPermission("user-1", samplePermissionApplicationPayload);
    const writeTimeoutMs = timeoutSpy.mock.calls[0][0];

    timeoutSpy.mockClear();
    fetchMock.mockResolvedValue(jsonResponse({ permissions: [] }));
    await makeClient().fetchPermissions("user-1");
    const readTimeoutMs = timeoutSpy.mock.calls[0][0];

    expect(writeTimeoutMs).toBeGreaterThan(readTimeoutMs);
    timeoutSpy.mockRestore();
  });

  it("test_notifyFlightPlan_requests_a_longer_timeout_than_read_requests", async () => {
    const timeoutSpy = vi.spyOn(AbortSignal, "timeout");
    fetchMock.mockResolvedValue(jsonResponse(guidelineNotifySuccessResponse));

    await makeClient().notifyFlightPlan("user-1", samplePayload);
    const writeTimeoutMs = timeoutSpy.mock.calls[0][0];

    timeoutSpy.mockClear();
    fetchMock.mockResolvedValue(jsonResponse({ permissions: [] }));
    await makeClient().fetchPermissions("user-1");
    const readTimeoutMs = timeoutSpy.mock.calls[0][0];

    expect(writeTimeoutMs).toBeGreaterThan(readTimeoutMs);
    timeoutSpy.mockRestore();
  });

  it("test_applyPermission_throws_possibly_accepted_timeout_error_on_timeout", async () => {
    // AbortSignal.timeout() が発火すると fetch は "TimeoutError" という名前の
    // DOMException で reject する (仕様・undici 実装とも共通)
    fetchMock.mockRejectedValue(
      new DOMException("The operation was aborted due to timeout", "TimeoutError")
    );

    await expect(
      makeClient().applyPermission("user-1", samplePermissionApplicationPayload)
    ).rejects.toBeInstanceOf(DipsPossiblyAcceptedTimeoutError);
  });

  it("test_applyPermission_timeout_error_message_mentions_possible_acceptance", async () => {
    fetchMock.mockRejectedValue(
      new DOMException("The operation was aborted due to timeout", "TimeoutError")
    );

    await expect(
      makeClient().applyPermission("user-1", samplePermissionApplicationPayload)
    ).rejects.toThrow(/受理済み/);
  });

  it("test_notifyFlightPlan_throws_possibly_accepted_timeout_error_on_timeout", async () => {
    fetchMock.mockRejectedValue(
      new DOMException("The operation was aborted due to timeout", "TimeoutError")
    );

    await expect(makeClient().notifyFlightPlan("user-1", samplePayload)).rejects.toBeInstanceOf(
      DipsPossiblyAcceptedTimeoutError
    );
  });

  it("test_fetchPermissions_throws_plain_api_error_on_timeout_not_possibly_accepted", async () => {
    // 冪等な GET (許可・承認情報取得) は再送しても重複登録の懸念がないため、
    // タイムアウトしても通常の DipsApiError のままでよい (専用エラーへ格上げしない)
    fetchMock.mockRejectedValue(
      new DOMException("The operation was aborted due to timeout", "TimeoutError")
    );

    await expect(makeClient().fetchPermissions("user-1")).rejects.toMatchObject({
      name: "DipsApiError",
    });
  });
});
