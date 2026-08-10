import { describe, it, expect, vi, afterEach } from "vitest";
import {
  fetchDipsOwnedAircrafts,
  DipsAuthRequiredClientError,
  AppSessionExpiredClientError,
} from "@/lib/api/dips";
import type { DipsOwnedAircraftDto } from "@/lib/api/dips";

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

  it("test_fetchDipsOwnedAircrafts_returns_empty_array_when_every_entry_fails_dto_validation", async () => {
    const invalidAircraft = { ...validAircraft, weightGrams: "not-a-number" };
    mockFetchJson({ aircrafts: [invalidAircraft], excludedCount: 0 });

    const result = await fetchDipsOwnedAircrafts();

    expect(result.aircrafts).toEqual([]);
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
