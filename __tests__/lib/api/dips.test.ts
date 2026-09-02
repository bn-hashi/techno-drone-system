import { describe, it, expect, vi, afterEach } from "vitest";
import {
  fetchDipsOwnedAircrafts,
  fetchDipsPermissions,
  searchDipsFlightProhibitedAreas,
  searchDipsFlightPlans,
  unlinkDipsAccount,
  DipsAuthRequiredClientError,
  AppSessionExpiredClientError,
} from "@/lib/api/dips";
import type {
  DipsOwnedAircraftDto,
  DipsPermissionInfo,
  DipsFlightProhibitedAreaInfo,
  DipsFlightPlanInfo,
} from "@/lib/api/dips";

const validAircraft: DipsOwnedAircraftDto = {
  registrationCode: "DUMMY0000001",
  manufacturer: "サンプル製造者",
  modelNumber: "サンプル型式",
  serialNumber: "SN0000001",
  weightGrams: 1500,
  status: 1,
  deregistrationReason: null,
  validPeriodEnd: "2028-06-19T00:00:00+09:00",
  remoteIdType: 1,
  ownerCategory: 1,
  isSelectable: true,
};

function mockFetchJson(body: unknown, status = 200): void {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      status,
      ok: status >= 200 && status < 300,
      json: () => Promise.resolve(body),
    })
  );
}

describe("fetchDipsOwnedAircrafts", () => {
  afterEach(() => {
    // global.fetch への直接代入は vi.restoreAllMocks() では復元されないため、
    // vi.stubGlobal で差し替えたグローバルは必ず vi.unstubAllGlobals で戻す
    // (CodeRabbit 指摘: beforeEach ではなく afterEach で復元し、他ファイル実行後に
    // モックが残留しないようにする)
    vi.unstubAllGlobals();
  });

  it("test_fetchDipsOwnedAircrafts_returns_aircrafts_on_success", async () => {
    mockFetchJson({ aircrafts: [validAircraft], excludedCount: 0 });

    const result = await fetchDipsOwnedAircrafts();

    expect(result.aircrafts).toEqual([validAircraft]);
  });

  it("test_fetchDipsOwnedAircrafts_propagates_excluded_count_from_response", async () => {
    mockFetchJson({ aircrafts: [validAircraft], excludedCount: 2 });

    const result = await fetchDipsOwnedAircrafts();

    expect(result.excludedCount).toBe(2);
  });

  it("test_fetchDipsOwnedAircrafts_defaults_excluded_count_to_zero_when_omitted", async () => {
    mockFetchJson({ aircrafts: [validAircraft] });

    const result = await fetchDipsOwnedAircrafts();

    expect(result.excludedCount).toBe(0);
  });

  it("test_fetchDipsOwnedAircrafts_does_not_drop_all_when_one_aircraft_has_unexpected_status_code", async () => {
    // 回帰テスト (修正2): status/remoteIdType/ownerCategory/deregistrationReason を
    // literal union で固定していたため、18機のうち1機でも別紙1 未定義のコード値を
    // 返すと z.array(...).safeParse が配列全体を落としていた。サーバー側と同じ寛容パース
    // (任意の number を受理) に寄せたことで、1機の想定外値でも残りの機体は取り込める。
    const unexpectedStatusAircraft: DipsOwnedAircraftDto = {
      ...validAircraft,
      registrationCode: "DUMMY0000099",
      status: 99,
      remoteIdType: 9,
      ownerCategory: 9,
      deregistrationReason: 99,
    };
    mockFetchJson({ aircrafts: [validAircraft, unexpectedStatusAircraft], excludedCount: 0 });

    const result = await fetchDipsOwnedAircrafts();

    expect(result.aircrafts).toHaveLength(2);
  });

  it("test_fetchDipsOwnedAircrafts_keeps_unexpected_status_code_value_as_is", async () => {
    const unexpectedStatusAircraft: DipsOwnedAircraftDto = {
      ...validAircraft,
      registrationCode: "DUMMY0000099",
      status: 99,
    };
    mockFetchJson({ aircrafts: [validAircraft, unexpectedStatusAircraft], excludedCount: 0 });

    const result = await fetchDipsOwnedAircrafts();

    expect(result.aircrafts[1].status).toBe(99);
  });

  it("test_fetchDipsOwnedAircrafts_drops_only_the_entry_that_fails_dto_validation", async () => {
    // 回帰テスト (修正1: A1): サーバー側 (edcc694) はエントリ単位でフォールバックするが、
    // クライアント側が配列全体を z.array(...).safeParse していたため、レスポンスが
    // 正しく届いても1機の DTO 検証失敗で全機を失っていた。エントリ単位で safeParse する
    // ことで、検証に失敗した機体だけを除外し、残りは取り込めることを確認する。
    const invalidAircraft = { ...validAircraft, registrationCode: "DUMMY0000098", weightGrams: "not-a-number" };
    mockFetchJson({ aircrafts: [validAircraft, invalidAircraft], excludedCount: 0 });

    const result = await fetchDipsOwnedAircrafts();

    expect(result.aircrafts).toEqual([validAircraft]);
  });

  it("test_fetchDipsOwnedAircrafts_counts_client_side_dto_validation_failure_in_excluded_count", async () => {
    // CodeRabbit 2026-08-10 2回目レビュー指摘: クライアント側の DTO 検証で落とした件数が
    // excludedCount に加算されておらず、サーバーが 0 を返すとクライアントで1件除外しても
    // 除外通知が出なかった。ここでは server excludedCount: 0 のときクライアント側の1件が
    // そのまま excludedCount に反映されることを確認する。
    const invalidAircraft = { ...validAircraft, registrationCode: "DUMMY0000098", weightGrams: "not-a-number" };
    mockFetchJson({ aircrafts: [validAircraft, invalidAircraft], excludedCount: 0 });

    const result = await fetchDipsOwnedAircrafts();

    expect(result.excludedCount).toBe(1);
  });

  it("test_fetchDipsOwnedAircrafts_adds_client_side_excluded_count_to_server_side_excluded_count", async () => {
    // サーバー側 (パース失敗) とクライアント側 (DTO 検証失敗) の除外は別の原因で発生しうる
    // ため、合算されることを確認する (サーバー2件 + クライアント1件 = 3件)。
    const invalidAircraft = { ...validAircraft, registrationCode: "DUMMY0000098", weightGrams: "not-a-number" };
    mockFetchJson({ aircrafts: [validAircraft, invalidAircraft], excludedCount: 2 });

    const result = await fetchDipsOwnedAircrafts();

    expect(result.excludedCount).toBe(3);
  });

  it("test_fetchDipsOwnedAircrafts_returns_empty_array_when_every_entry_fails_dto_validation", async () => {
    const invalidAircraft = { ...validAircraft, weightGrams: "not-a-number" };
    mockFetchJson({ aircrafts: [invalidAircraft], excludedCount: 0 });

    const result = await fetchDipsOwnedAircrafts();

    expect(result.aircrafts).toEqual([]);
  });

  it("test_fetchDipsOwnedAircrafts_counts_all_entries_as_excluded_when_every_entry_fails_dto_validation", async () => {
    const invalidAircraft = { ...validAircraft, weightGrams: "not-a-number" };
    mockFetchJson({ aircrafts: [invalidAircraft], excludedCount: 0 });

    const result = await fetchDipsOwnedAircrafts();

    expect(result.excludedCount).toBe(1);
  });

  it("test_fetchDipsOwnedAircrafts_throws_auth_required_error_on_401", async () => {
    mockFetchJson({ error: "DIPSへのログインが必要です", authRequired: true, realm: "utm" }, 401);

    await expect(fetchDipsOwnedAircrafts()).rejects.toBeInstanceOf(DipsAuthRequiredClientError);
  });

  it("test_fetchDipsOwnedAircrafts_throws_app_session_expired_error_on_plain_401", async () => {
    // requireFlightAccess() が返す素の 401 ({ error: "Unauthorized" }、authRequired なし) は
    // DIPS の再認可ではなくアプリ自体のセッション切れ。専用のエラー型で区別する (B4)
    mockFetchJson({ error: "Unauthorized" }, 401);

    await expect(fetchDipsOwnedAircrafts()).rejects.toBeInstanceOf(AppSessionExpiredClientError);
  });

  it("test_fetchDipsOwnedAircrafts_throws_japanese_message_on_403", async () => {
    // requireFlightAccess() が返す素の 403 ({ error: "Forbidden" }) を英語のまま
    // 画面に出さない (B4)
    mockFetchJson({ error: "Forbidden" }, 403);

    await expect(fetchDipsOwnedAircrafts()).rejects.toThrow("この操作を行う権限がありません");
  });

  it("test_fetchDipsOwnedAircrafts_throws_when_response_shape_is_invalid", async () => {
    mockFetchJson({ aircrafts: "not-an-array" });

    await expect(fetchDipsOwnedAircrafts()).rejects.toThrow(
      "DIPS機体情報の取得に失敗しました: レスポンスの形式が不正です"
    );
  });

  it("test_fetchDipsOwnedAircrafts_throws_japanese_message_when_fetch_itself_fails", async () => {
    // 2026-09-02 差し戻し H4: fetch() 自体がネットワーク断等で失敗すると、ブラウザの生の
    // TypeError ("Failed to fetch") がそのまま DipsAircraftPickerModal.tsx / DipsVerifyButton.tsx
    // の画面に出てしまっていた。fetchDipsPermissions (D4 差し戻し) 側にしか try/catch による
    // 日本語化が入っておらず、fetchDipsOwnedAircrafts 側は移行漏れだった。
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));

    await expect(fetchDipsOwnedAircrafts()).rejects.toThrow(
      "DIPS機体情報の取得に失敗しました。ネットワーク接続を確認してください"
    );
  });
});

const validPermission: DipsPermissionInfo = {
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

describe("fetchDipsPermissions", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("test_fetchDipsPermissions_returns_permissions_on_success", async () => {
    mockFetchJson({ permissions: [validPermission], excludedCount: 0 });

    const result = await fetchDipsPermissions();

    expect(result.permissions).toEqual([validPermission]);
  });

  it("test_fetchDipsPermissions_propagates_excluded_count_from_response", async () => {
    mockFetchJson({ permissions: [validPermission], excludedCount: 2 });

    const result = await fetchDipsPermissions();

    expect(result.excludedCount).toBe(2);
  });

  it("test_fetchDipsPermissions_defaults_excluded_count_to_zero_when_omitted", async () => {
    mockFetchJson({ permissions: [validPermission] });

    const result = await fetchDipsPermissions();

    expect(result.excludedCount).toBe(0);
  });

  it("test_fetchDipsPermissions_throws_when_response_shape_is_invalid", async () => {
    // A3 差し戻し: 以前は permissions キーが省略された 200 応答 (キー名違い・非 JSON 応答
    // の両方で起こりうる) を `?? []` で静かに「0件」扱いにしていた。fetchDipsOwnedAircrafts
    // の parseOwnedAircrafts と同じ強度で、キー欠落もエラーとして表面化させる
    mockFetchJson({});

    await expect(fetchDipsPermissions()).rejects.toThrow(
      "DIPS許可・承認情報の取得に失敗しました: レスポンスの形式が不正です"
    );
  });

  it("test_fetchDipsPermissions_throws_when_permissions_is_not_an_array", async () => {
    mockFetchJson({ permissions: "not-an-array" });

    await expect(fetchDipsPermissions()).rejects.toThrow(
      "DIPS許可・承認情報の取得に失敗しました: レスポンスの形式が不正です"
    );
  });

  it("test_fetchDipsPermissions_throws_when_response_body_is_not_json", async () => {
    // 実機検証 (2026-08-19) 再現: 200 だが本文が非 JSON (<html>502...) のとき、
    // res.json() が失敗して body が null になり、以前は「0件」として静かに成功していた
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        status: 200,
        ok: true,
        json: () => Promise.reject(new SyntaxError("Unexpected token < in JSON")),
      })
    );

    await expect(fetchDipsPermissions()).rejects.toThrow(
      "DIPS許可・承認情報の取得に失敗しました: レスポンスの形式が不正です"
    );
  });

  it("test_fetchDipsPermissions_keeps_permission_with_null_permission_date", async () => {
    // F5 差し戻し: permissionDate は画面に表示しないフィールドのため、サーバー側が
    // 想定外の型を null に丸めて返した場合に、クライアント側の再検証 (A3) が
    // それを不正な値として弾いて除外してしまわないことを確認する
    const permissionWithNullDate = { ...validPermission, permissionDate: null };
    mockFetchJson({ permissions: [permissionWithNullDate], excludedCount: 0 });

    const result = await fetchDipsPermissions();

    expect(result.permissions).toEqual([permissionWithNullDate]);
  });

  it("test_fetchDipsPermissions_drops_only_the_entry_that_fails_client_side_validation", async () => {
    const invalidPermission = { ...validPermission, receptionNumber: 12345 };
    mockFetchJson({ permissions: [validPermission, invalidPermission], excludedCount: 0 });

    const result = await fetchDipsPermissions();

    expect(result.permissions).toEqual([validPermission]);
  });

  it("test_fetchDipsPermissions_counts_client_side_validation_failure_in_excluded_count", async () => {
    const invalidPermission = { ...validPermission, receptionNumber: 12345 };
    mockFetchJson({ permissions: [validPermission, invalidPermission], excludedCount: 0 });

    const result = await fetchDipsPermissions();

    expect(result.excludedCount).toBe(1);
  });

  it("test_fetchDipsPermissions_adds_client_side_excluded_count_to_server_side_excluded_count", async () => {
    const invalidPermission = { ...validPermission, receptionNumber: 12345 };
    mockFetchJson({ permissions: [validPermission, invalidPermission], excludedCount: 2 });

    const result = await fetchDipsPermissions();

    expect(result.excludedCount).toBe(3);
  });

  it("test_fetchDipsPermissions_throws_auth_required_error_with_req_realm_on_401", async () => {
    mockFetchJson({ error: "DIPSへのログインが必要です", authRequired: true, realm: "req" }, 401);

    await expect(fetchDipsPermissions()).rejects.toBeInstanceOf(DipsAuthRequiredClientError);
  });

  it("test_fetchDipsPermissions_auth_required_error_carries_realm_from_response", async () => {
    mockFetchJson({ error: "DIPSへのログインが必要です", authRequired: true, realm: "req" }, 401);

    // D3 差し戻し: 以前は .catch() 内で expect していたため、promise が resolve すると
    // アサーション0件のまま緑になっていた。他のテストと同じ rejects.toMatchObject に直す
    await expect(fetchDipsPermissions()).rejects.toMatchObject({ realm: "req" });
  });

  it("test_fetchDipsPermissions_throws_app_session_expired_error_on_plain_401", async () => {
    // requireFlightAccess() が返す素の 401 ({ error: "Unauthorized" }、authRequired なし) は
    // DIPS の再認可ではなくアプリ自体のセッション切れ
    mockFetchJson({ error: "Unauthorized" }, 401);

    await expect(fetchDipsPermissions()).rejects.toBeInstanceOf(AppSessionExpiredClientError);
  });

  it("test_fetchDipsPermissions_throws_japanese_message_on_403", async () => {
    mockFetchJson({ error: "Forbidden" }, 403);

    await expect(fetchDipsPermissions()).rejects.toThrow("この操作を行う権限がありません");
  });

  it("test_fetchDipsPermissions_throws_server_error_message_on_failure", async () => {
    mockFetchJson({ error: "DIPS連携でエラーが発生しました" }, 502);

    await expect(fetchDipsPermissions()).rejects.toThrow("DIPS連携でエラーが発生しました");
  });

  it("test_fetchDipsPermissions_throws_default_message_when_error_body_is_missing_on_failure", async () => {
    mockFetchJson({}, 502);

    await expect(fetchDipsPermissions()).rejects.toThrow("DIPS許可・承認情報の取得に失敗しました");
  });

  it("test_fetchDipsPermissions_throws_japanese_message_when_fetch_itself_fails", async () => {
    // D4 差し戻し: fetch() 自体がネットワーク断等で失敗すると、ブラウザの生の TypeError
    // ("Failed to fetch") がそのまま画面に出ていた。日本語メッセージに正規化する
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new TypeError("Failed to fetch"))
    );

    await expect(fetchDipsPermissions()).rejects.toThrow(
      "DIPS許可・承認情報の取得に失敗しました。ネットワーク接続を確認してください"
    );
  });
});

describe("unlinkDipsAccount", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("test_unlinkDipsAccount_calls_delete_on_the_realm_scoped_endpoint", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      status: 200,
      ok: true,
      json: () => Promise.resolve({ success: true }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await unlinkDipsAccount("utm");

    expect(fetchMock).toHaveBeenCalledWith("/api/dips/tokens/utm", { method: "DELETE" });
  });

  it("test_unlinkDipsAccount_resolves_on_success", async () => {
    mockFetchJson({ success: true });

    await expect(unlinkDipsAccount("utm")).resolves.toBeUndefined();
  });

  it("test_unlinkDipsAccount_throws_app_session_expired_error_on_401", async () => {
    mockFetchJson({ error: "Unauthorized" }, 401);

    await expect(unlinkDipsAccount("utm")).rejects.toBeInstanceOf(AppSessionExpiredClientError);
  });

  it("test_unlinkDipsAccount_throws_japanese_message_on_403", async () => {
    mockFetchJson({ error: "Forbidden" }, 403);

    await expect(unlinkDipsAccount("utm")).rejects.toThrow("この操作を行う権限がありません");
  });

  it("test_unlinkDipsAccount_throws_server_error_message_on_failure", async () => {
    mockFetchJson({ error: "内部エラーが発生しました" }, 500);

    await expect(unlinkDipsAccount("utm")).rejects.toThrow("内部エラーが発生しました");
  });

  it("test_unlinkDipsAccount_throws_default_message_when_error_body_is_missing", async () => {
    mockFetchJson({}, 500);

    await expect(unlinkDipsAccount("utm")).rejects.toThrow("DIPS連携の解除に失敗しました");
  });
});

const validArea: DipsFlightProhibitedAreaInfo = {
  areaId: "20221105_FISSikou0015",
  name: "東京国際空港 空港の区域",
  detail: "小型無人機等飛行禁止法に基づく飛行禁止空域",
  url: "https://www.mlit.go.jp/koku/koku_tk2_000023.html",
  areaTypeId: 5,
  startTime: "2022-10-01T09:00:00",
  finishTime: "9999-12-31T23:59:00",
  range: { type: "Polygon", center: [], radius: 0, coordinates: [[139.779031, 35.569748]] },
};

const searchInput = {
  centerLongitude: 139.7686,
  centerLatitude: 35.6803,
  radiusMeters: 1000,
  flightProhibitedAreaTypeIds: [5, 6],
};

describe("searchDipsFlightProhibitedAreas", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("test_searchDipsFlightProhibitedAreas_posts_input_as_json_body", async () => {
    mockFetchJson({ areas: [], excludedCount: 0 });

    await searchDipsFlightProhibitedAreas(searchInput);

    const [, init] = vi.mocked(fetch).mock.calls[0];
    expect(JSON.parse(init?.body as string)).toEqual(searchInput);
  });

  it("test_searchDipsFlightProhibitedAreas_returns_areas_on_success", async () => {
    mockFetchJson({ areas: [validArea], excludedCount: 0 });

    const result = await searchDipsFlightProhibitedAreas(searchInput);

    expect(result.areas).toEqual([validArea]);
  });

  it("test_searchDipsFlightProhibitedAreas_defaults_excluded_count_to_zero_when_omitted", async () => {
    mockFetchJson({ areas: [validArea] });

    const result = await searchDipsFlightProhibitedAreas(searchInput);

    expect(result.excludedCount).toBe(0);
  });

  it("test_searchDipsFlightProhibitedAreas_throws_when_areas_is_not_an_array", async () => {
    mockFetchJson({ areas: "not-an-array" });

    await expect(searchDipsFlightProhibitedAreas(searchInput)).rejects.toThrow(
      "DIPS飛行禁止エリア情報の取得に失敗しました: レスポンスの形式が不正です"
    );
  });

  it("test_searchDipsFlightProhibitedAreas_drops_only_the_entry_that_fails_client_side_validation", async () => {
    const invalidArea = { ...validArea, areaTypeId: "not-a-number" };
    mockFetchJson({ areas: [validArea, invalidArea], excludedCount: 0 });

    const result = await searchDipsFlightProhibitedAreas(searchInput);

    expect({ areas: result.areas, excludedCount: result.excludedCount }).toEqual({
      areas: [validArea],
      excludedCount: 1,
    });
  });

  it("test_searchDipsFlightProhibitedAreas_throws_auth_required_error_with_fpl_realm_on_401", async () => {
    mockFetchJson({ error: "DIPSへのログインが必要です", authRequired: true, realm: "fpl" }, 401);

    await expect(searchDipsFlightProhibitedAreas(searchInput)).rejects.toMatchObject({
      realm: "fpl",
    });
    mockFetchJson({ error: "DIPSへのログインが必要です", authRequired: true, realm: "fpl" }, 401);
    await expect(searchDipsFlightProhibitedAreas(searchInput)).rejects.toBeInstanceOf(
      DipsAuthRequiredClientError
    );
  });

  it("test_searchDipsFlightProhibitedAreas_throws_app_session_expired_error_on_plain_401", async () => {
    mockFetchJson({ error: "Unauthorized" }, 401);

    await expect(searchDipsFlightProhibitedAreas(searchInput)).rejects.toBeInstanceOf(
      AppSessionExpiredClientError
    );
  });

  it("test_searchDipsFlightProhibitedAreas_throws_japanese_message_when_fetch_itself_fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));

    await expect(searchDipsFlightProhibitedAreas(searchInput)).rejects.toThrow(
      "DIPS飛行禁止エリア情報の取得に失敗しました。ネットワーク接続を確認してください"
    );
  });
});

const validFlightPlan: DipsFlightPlanInfo = {
  flightPlanId: "PLAN-1",
  name: null,
  flightPurpose: null,
  flightAirspace: null,
  flightType: null,
  assistantsNumber: null,
  departurePoint: null,
  destinationPoint: null,
  startTime: "20261125 1130",
  finishTime: "20261125 1230",
  plannedMaxTime: 120,
  plannedFlightTime: 60,
  flightSpeed: 100,
  flightAltitude: 120,
  flyRoute: { type: "Circle", center: [139.4677, 35.6476], radius: 150, coordinates: [] },
  riskMitigationOnsiteControl: null,
  riskMitigationOnsiteControlL3: null,
  riskMitigationOnsiteControlL35: null,
  riskMitigationOnsiteControl2: null,
  exceptionalConditionsMooring: null,
  insuranceInformation: null,
  otherInformation: null,
  pilotInfo: null,
  aircraftInfo: null,
  flightPermitApplicationInfo: null,
};

const flightPlanSearchInput = { centerLongitude: 139.4677, centerLatitude: 35.6476, radiusMeters: 10000 };

describe("searchDipsFlightPlans", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("test_searchDipsFlightPlans_posts_input_as_json_body", async () => {
    mockFetchJson({ flightPlans: [], excludedCount: 0 });

    await searchDipsFlightPlans(flightPlanSearchInput);

    const [, init] = vi.mocked(fetch).mock.calls[0];
    expect(JSON.parse(init?.body as string)).toEqual(flightPlanSearchInput);
  });

  it("test_searchDipsFlightPlans_returns_flight_plans_on_success", async () => {
    mockFetchJson({ flightPlans: [validFlightPlan], excludedCount: 0 });

    const result = await searchDipsFlightPlans(flightPlanSearchInput);

    expect(result.flightPlans).toEqual([validFlightPlan]);
  });

  it("test_searchDipsFlightPlans_defaults_excluded_count_to_zero_when_omitted", async () => {
    mockFetchJson({ flightPlans: [validFlightPlan] });

    const result = await searchDipsFlightPlans(flightPlanSearchInput);

    expect(result.excludedCount).toBe(0);
  });

  it("test_searchDipsFlightPlans_throws_when_flight_plans_is_not_an_array", async () => {
    mockFetchJson({ flightPlans: "not-an-array" });

    await expect(searchDipsFlightPlans(flightPlanSearchInput)).rejects.toThrow(
      "DIPS飛行計画情報の取得に失敗しました: レスポンスの形式が不正です"
    );
  });

  it("test_searchDipsFlightPlans_drops_only_the_entry_that_fails_client_side_validation", async () => {
    const invalidPlan = { ...validFlightPlan, flightSpeed: "not-a-number" };
    mockFetchJson({ flightPlans: [validFlightPlan, invalidPlan], excludedCount: 0 });

    const result = await searchDipsFlightPlans(flightPlanSearchInput);

    expect({ flightPlans: result.flightPlans, excludedCount: result.excludedCount }).toEqual({
      flightPlans: [validFlightPlan],
      excludedCount: 1,
    });
  });

  it("test_searchDipsFlightPlans_throws_auth_required_error_with_fpl_realm_on_401", async () => {
    mockFetchJson({ error: "DIPSへのログインが必要です", authRequired: true, realm: "fpl" }, 401);

    await expect(searchDipsFlightPlans(flightPlanSearchInput)).rejects.toBeInstanceOf(
      DipsAuthRequiredClientError
    );
  });

  it("test_searchDipsFlightPlans_throws_app_session_expired_error_on_plain_401", async () => {
    mockFetchJson({ error: "Unauthorized" }, 401);

    await expect(searchDipsFlightPlans(flightPlanSearchInput)).rejects.toBeInstanceOf(
      AppSessionExpiredClientError
    );
  });

  it("test_searchDipsFlightPlans_throws_japanese_message_when_fetch_itself_fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));

    await expect(searchDipsFlightPlans(flightPlanSearchInput)).rejects.toThrow(
      "DIPS飛行計画情報の取得に失敗しました。ネットワーク接続を確認してください"
    );
  });
});
