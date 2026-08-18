import { describe, it, expect, vi, afterEach } from "vitest";
import {
  fetchDipsOwnedAircrafts,
  fetchDipsPermissions,
  unlinkDipsAccount,
  DipsAuthRequiredClientError,
  AppSessionExpiredClientError,
} from "@/lib/api/dips";
import type { DipsOwnedAircraftDto, DipsPermissionInfo } from "@/lib/api/dips";

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

  it("test_fetchDipsPermissions_defaults_permissions_to_empty_array_when_omitted", async () => {
    mockFetchJson({});

    const result = await fetchDipsPermissions();

    expect(result.permissions).toEqual([]);
  });

  it("test_fetchDipsPermissions_throws_auth_required_error_with_req_realm_on_401", async () => {
    mockFetchJson({ error: "DIPSへのログインが必要です", authRequired: true, realm: "req" }, 401);

    await expect(fetchDipsPermissions()).rejects.toBeInstanceOf(DipsAuthRequiredClientError);
  });

  it("test_fetchDipsPermissions_auth_required_error_carries_realm_from_response", async () => {
    mockFetchJson({ error: "DIPSへのログインが必要です", authRequired: true, realm: "req" }, 401);

    await fetchDipsPermissions().catch((err) => {
      expect(err.realm).toBe("req");
    });
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
