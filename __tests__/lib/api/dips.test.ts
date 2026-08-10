import { describe, it, expect, vi, beforeEach } from "vitest";
import { fetchDipsOwnedAircrafts, DipsAuthRequiredClientError } from "@/lib/api/dips";
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
  global.fetch = vi.fn().mockResolvedValue({
    status,
    ok: status >= 200 && status < 300,
    json: () => Promise.resolve(body),
  });
}

describe("fetchDipsOwnedAircrafts", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("test_fetchDipsOwnedAircrafts_returns_aircrafts_on_success", async () => {
    mockFetchJson({ aircrafts: [validAircraft] });

    const result = await fetchDipsOwnedAircrafts();

    expect(result).toEqual([validAircraft]);
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
    mockFetchJson({ aircrafts: [validAircraft, unexpectedStatusAircraft] });

    const result = await fetchDipsOwnedAircrafts();

    expect(result).toHaveLength(2);
    expect(result[1].status).toBe(99);
  });

  it("test_fetchDipsOwnedAircrafts_throws_auth_required_error_on_401", async () => {
    mockFetchJson({ error: "DIPSへのログインが必要です", authRequired: true, realm: "utm" }, 401);

    await expect(fetchDipsOwnedAircrafts()).rejects.toBeInstanceOf(DipsAuthRequiredClientError);
  });

  it("test_fetchDipsOwnedAircrafts_throws_when_response_shape_is_invalid", async () => {
    mockFetchJson({ aircrafts: [{ registrationCode: "DUMMY0000001" }] });

    await expect(fetchDipsOwnedAircrafts()).rejects.toThrow(
      "DIPS機体情報の取得に失敗しました: レスポンスの形式が不正です"
    );
  });
});
