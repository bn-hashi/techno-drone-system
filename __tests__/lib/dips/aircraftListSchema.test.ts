import { describe, it, expect } from "vitest";
import { normalizeAircraftList } from "@/lib/dips/aircraftListSchema";
import { DipsApiError } from "@/lib/dips/errors";
import {
  accountAResponse,
  accountBResponse,
  accountCResponse,
  accountDResponse,
  piiProbeResponse,
} from "@/test-fixtures/dips/aircraftListFixtures";

/** アサーション対象の機体を登録記号で探す (見つからなければテスト自体を失敗させる) */
function findByRegSymbol(aircrafts: ReturnType<typeof normalizeAircraftList>, regSymbol: string) {
  const found = aircrafts.find((a) => a.regSymbol === regSymbol);
  if (!found) throw new Error(`テストフィクスチャに ${regSymbol} が見つかりません`);
  return found;
}

/** 最小限の有効な生レスポンス1件 (アドホックなケース用。フィクスチャを使わない) */
function minimalValidRawEntry(overrides: Record<string, unknown> = {}) {
  return {
    aircraft_information: {
      registration_code: "JU9999999999",
      manufacturing_number: "MANUFACT99",
      manufacturing_category: 1,
      aircraft_type: 1,
      manufacturer_jpn: "サンプル製造者",
      model_jpn: "サンプル型式",
      manufacturer_eng: "Sample Maker",
      model_eng: "Sample Model",
      aircraft_weight: 1.5,
      maximum_takeoff_weight: 2.0,
      aircraft_status: 1,
      erase_reason_number: "",
      erase_reason_other: "",
      effectiveness_period_self: "2025-06-20T00:00:00+09:00",
      effectiveness_period_to: "2028-06-19T00:00:00+09:00",
      rid_type: 1,
      ...overrides,
    },
    owner_information: { owner_classification: 1 },
    user_information: { user_classification: "" },
  };
}

describe("normalizeAircraftList", () => {
  it("test_parse_returns_empty_array_when_account_owns_no_aircraft", () => {
    const result = normalizeAircraftList(accountCResponse);

    expect(result).toEqual([]);
  });

  it("test_parse_returns_all_aircrafts_for_multi_owner_account", () => {
    const result = normalizeAircraftList(accountAResponse);

    expect(result).toHaveLength(9);
  });

  it("test_parse_maps_registration_code_to_reg_symbol", () => {
    const result = normalizeAircraftList(accountBResponse);

    expect(result[0].regSymbol).toBe("DUMMY0000008");
  });

  it("test_parse_maps_aircraft_status_expired_to_2", () => {
    const result = normalizeAircraftList(accountAResponse);

    expect(findByRegSymbol(result, "DUMMY0000010").uaStatus).toBe(2);
  });

  it("test_parse_maps_deregistered_aircraft_status_to_3", () => {
    const result = normalizeAircraftList(accountAResponse);

    expect(findByRegSymbol(result, "DUMMY0000009").uaStatus).toBe(3);
  });

  describe.each([
    ["DUMMY0000009", 5], // 機体09 (アカウントA)
    ["DUMMY0000013", 1], // 機体13 (アカウントD)
    ["DUMMY0000014", 2], // 機体14
    ["DUMMY0000015", 3], // 機体15
    ["DUMMY0000016", 4], // 機体16
    ["DUMMY0000017", 6], // 機体17
    ["DUMMY0000018", 7], // 機体18
  ])("test_parse_returns_deregistration_reason_for_each_of_seven_reasons", (regSymbol, reason) => {
    it(`${regSymbol} -> 抹消理由 ${reason}`, () => {
      const result = normalizeAircraftList([...accountAResponse, ...accountDResponse]);

      expect(findByRegSymbol(result, regSymbol).deregistrationReason).toBe(reason);
    });
  });

  it("test_parse_returns_null_deregistration_reason_when_status_is_active", () => {
    const result = normalizeAircraftList(accountAResponse);

    expect(findByRegSymbol(result, "DUMMY0000001").deregistrationReason).toBeNull();
  });

  it("test_parse_maps_remote_id_type_none", () => {
    const result = normalizeAircraftList(accountAResponse);

    expect(findByRegSymbol(result, "DUMMY0000007").remoteIdType).toBe(0);
  });

  it("test_parse_maps_remote_id_type_builtin", () => {
    const result = normalizeAircraftList(accountAResponse);

    expect(findByRegSymbol(result, "DUMMY0000001").remoteIdType).toBe(1);
  });

  it("test_parse_maps_remote_id_type_external", () => {
    const result = normalizeAircraftList(accountAResponse);

    expect(findByRegSymbol(result, "DUMMY0000003").remoteIdType).toBe(2);
  });

  it("test_parse_maps_owner_category_corporate_for_corporate_account", () => {
    const result = normalizeAircraftList(accountDResponse);

    expect(findByRegSymbol(result, "DUMMY0000012").ownerCategory).toBe(2);
  });

  it("test_parse_maps_user_category_corporate_value_9", () => {
    const result = normalizeAircraftList(accountDResponse);

    expect(findByRegSymbol(result, "DUMMY0000012").userCategory).toBe("9");
  });

  it("test_parse_excludes_transferred_aircraft_from_source_account", () => {
    const result = normalizeAircraftList(accountAResponse);

    expect(result.some((a) => a.regSymbol === "DUMMY0000011")).toBe(false);
  });

  it("test_parse_includes_transferred_aircraft_in_destination_account", () => {
    const result = normalizeAircraftList(accountDResponse);

    expect(result.some((a) => a.regSymbol === "DUMMY0000011")).toBe(true);
  });

  it("test_parse_drops_owner_personal_information", () => {
    const result = normalizeAircraftList(piiProbeResponse);

    expect(JSON.stringify(result)).not.toContain("PIIプローブ所有者");
  });

  it("test_parse_drops_user_personal_information", () => {
    const result = normalizeAircraftList(piiProbeResponse);

    expect(JSON.stringify(result)).not.toContain("PIIプローブ使用者");
  });

  it("test_parse_ignores_unknown_keys", () => {
    // フィクスチャは全件 remote_id_broadcast_method (未知キー) と future_extension_field
    // (トップレベルの未知キー) を含む。それでもパースが成功することを確認する
    expect(() => normalizeAircraftList(accountAResponse)).not.toThrow();
  });

  it("test_parse_throws_when_required_key_missing", () => {
    const broken = [minimalValidRawEntry()];
    delete (broken[0].aircraft_information as Record<string, unknown>).registration_code;

    expect(() => normalizeAircraftList(broken)).toThrow(DipsApiError);
  });

  it("test_parse_error_message_contains_only_key_name_not_value", () => {
    const broken = [minimalValidRawEntry()];
    delete (broken[0].aircraft_information as Record<string, unknown>).registration_code;

    try {
      normalizeAircraftList(broken);
      throw new Error("normalizeAircraftList が例外を投げませんでした");
    } catch (error) {
      expect(error).toBeInstanceOf(DipsApiError);
      const message = (error as DipsApiError).message;
      expect(message).toContain("registration_code");
      // 値は含まれていた覚えがない (undefined になったキーなので値そのものが存在しない)
      expect(message).not.toContain("MANUFACT99");
    }
  });

  it("test_parse_accepts_numeric_and_string_code_values", () => {
    const numericEntry = minimalValidRawEntry({ aircraft_status: 1 });
    const stringEntry = minimalValidRawEntry({ aircraft_status: "1" });

    const result = normalizeAircraftList([numericEntry, stringEntry]);

    expect(result.map((a) => a.uaStatus)).toEqual([1, 1]);
  });
});
