import { describe, it, expect, vi, afterEach } from "vitest";
import { normalizeAircraftList } from "@/lib/dips/aircraftListSchema";
import { DipsApiError } from "@/lib/dips/errors";
import { logger } from "@/lib/logger";
import {
  accountAResponse,
  accountBResponse,
  accountCResponse,
  accountDResponse,
  piiProbeResponse,
} from "@/test-fixtures/dips/aircraftListFixtures";

interface MutableAircraftEntry {
  aircraft_information: Record<string, unknown>;
  owner_information: Record<string, unknown>;
  user_information: Record<string, unknown>;
}

/**
 * フィクスチャの深いコピーを作り、指定した登録記号の機体の1フィールドだけを
 * 不正値に書き換える。他の機体は無傷のまま残るため、エントリ単位のフォールバックが
 * 「壊れた1機だけ」を落とすことを検証できる。
 */
function corruptFieldByRegSymbol(
  entries: readonly unknown[],
  regSymbol: string,
  section: "aircraft_information" | "owner_information",
  field: string,
  invalidValue: unknown
): unknown[] {
  const cloned = structuredClone(entries) as MutableAircraftEntry[];
  const target = cloned.find(
    (entry) => entry.aircraft_information.registration_code === regSymbol
  );
  if (!target) throw new Error(`テストフィクスチャに ${regSymbol} が見つかりません`);
  target[section][field] = invalidValue;
  return cloned;
}

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

  it("test_parse_throws_when_code_value_is_non_numeric_string", () => {
    // 異常系: aircraft_status が非数値文字列で返ってきた場合はパースエラーになる
    // (codeNumber の Number.isNaN ガード分岐)
    const broken = minimalValidRawEntry({ aircraft_status: "not-a-number" });

    expect(() => normalizeAircraftList([broken])).toThrow(DipsApiError);
  });

  it("test_parse_throws_when_aircraft_status_is_empty_string", () => {
    // 修正4回帰テスト: Number("") === 0 のため、空文字が黙って 0 (未定義のステータス)に
    // 化けていた。codeNumber は空文字を明示的に弾き、パースエラーにする必要がある。
    const broken = minimalValidRawEntry({ aircraft_status: "" });

    expect(() => normalizeAircraftList([broken])).toThrow(DipsApiError);
  });

  it("test_parse_throws_when_erase_reason_number_is_non_numeric_string", () => {
    // 異常系: erase_reason_number が非数値文字列で返ってきた場合はパースエラーになる
    // (nullableCodeNumber の Number.isNaN ガード分岐)
    const broken = minimalValidRawEntry({ erase_reason_number: "not-a-number" });

    expect(() => normalizeAircraftList([broken])).toThrow(DipsApiError);
  });

  it("test_parse_normalizes_null_erase_reason_number_to_null", () => {
    // 修正3回帰テスト: erase_reason_number が JSON の null で返ってもパースは失敗せず
    // deregistrationReason は null に正規化される (検証環境に事前到達できないため寛容側)
    const entry = minimalValidRawEntry({ erase_reason_number: null });

    const result = normalizeAircraftList([entry]);

    expect(result[0].deregistrationReason).toBeNull();
  });

  it("test_parse_normalizes_missing_erase_reason_number_key_to_null", () => {
    const entry = minimalValidRawEntry();
    delete (entry.aircraft_information as Record<string, unknown>).erase_reason_number;

    const result = normalizeAircraftList([entry]);

    expect(result[0].deregistrationReason).toBeNull();
  });

  it("test_parse_normalizes_null_erase_reason_other_to_null", () => {
    const entry = minimalValidRawEntry({ erase_reason_other: null });

    const result = normalizeAircraftList([entry]);

    expect(result[0].deregistrationReasonOther).toBeNull();
  });

  it("test_parse_normalizes_missing_erase_reason_other_key_to_null", () => {
    const entry = minimalValidRawEntry();
    delete (entry.aircraft_information as Record<string, unknown>).erase_reason_other;

    const result = normalizeAircraftList([entry]);

    expect(result[0].deregistrationReasonOther).toBeNull();
  });

  describe("エントリ単位のフォールバック (1機の異常値が他機体を巻き込まないこと)", () => {
    afterEach(() => {
      vi.restoreAllMocks();
    });

    it("test_parse_keeps_seventeen_aircrafts_when_one_of_eighteen_has_invalid_aircraft_status", () => {
      // コードレビュー指摘 (情報): 18機中1機の異常値でアカウント全体が502落ちしていた構造の回帰テスト
      const allEighteen = [...accountAResponse, ...accountBResponse, ...accountDResponse];
      expect(allEighteen).toHaveLength(18);
      const raw = corruptFieldByRegSymbol(
        allEighteen,
        "DUMMY0000001",
        "aircraft_information",
        "aircraft_status",
        "not-a-number"
      );

      const result = normalizeAircraftList(raw);

      expect(result).toHaveLength(17);
      expect(result.some((a) => a.regSymbol === "DUMMY0000001")).toBe(false);
    });

    it("test_parse_drops_only_the_entry_with_invalid_manufacturing_category", () => {
      // codeNumber を使う他フィールドの代表1: aircraft_information 直下のコード値
      const raw = corruptFieldByRegSymbol(
        accountAResponse,
        "DUMMY0000002",
        "aircraft_information",
        "manufacturing_category",
        null
      );

      const result = normalizeAircraftList(raw);

      expect(result).toHaveLength(accountAResponse.length - 1);
      expect(result.some((a) => a.regSymbol === "DUMMY0000002")).toBe(false);
      expect(result.some((a) => a.regSymbol === "DUMMY0000001")).toBe(true);
    });

    it("test_parse_drops_only_the_entry_with_invalid_owner_classification", () => {
      // codeNumber を使う他フィールドの代表2: owner_information (ネスト構造) 側のコード値
      const raw = corruptFieldByRegSymbol(
        accountAResponse,
        "DUMMY0000003",
        "owner_information",
        "owner_classification",
        null
      );

      const result = normalizeAircraftList(raw);

      expect(result).toHaveLength(accountAResponse.length - 1);
      expect(result.some((a) => a.regSymbol === "DUMMY0000003")).toBe(false);
    });

    it("test_parse_drops_only_the_entry_with_invalid_aircraft_weight", () => {
      // codeNumber を使う他フィールドの代表3: 重量系 (数値であることが前提の項目)
      const raw = corruptFieldByRegSymbol(
        accountAResponse,
        "DUMMY0000004",
        "aircraft_information",
        "aircraft_weight",
        null
      );

      const result = normalizeAircraftList(raw);

      expect(result).toHaveLength(accountAResponse.length - 1);
      expect(result.some((a) => a.regSymbol === "DUMMY0000004")).toBe(false);
    });

    it("test_parse_throws_when_all_entries_fail_to_parse", () => {
      // 全件失敗時は「所有機体0件」と誤解させる空配列ではなく DipsApiError を投げる
      const raw = accountAResponse.map((entry) => {
        const cloned = structuredClone(entry) as MutableAircraftEntry;
        cloned.aircraft_information.aircraft_status = "not-a-number";
        return cloned;
      });

      expect(() => normalizeAircraftList(raw)).toThrow(DipsApiError);
    });

    it("test_parse_throws_when_response_is_not_an_array", () => {
      // レスポンス自体が想定外の形 (配列ですらない) の場合は従来どおり DipsApiError
      expect(() => normalizeAircraftList({ aircrafts: [] })).toThrow(DipsApiError);
    });

    it("test_parse_logs_dropped_entry_count_and_zod_paths_without_pii_or_raw_values", () => {
      const spy = vi.spyOn(logger, "error").mockImplementation(() => {});
      const allEighteen = [...accountAResponse, ...accountBResponse, ...accountDResponse];
      const raw = corruptFieldByRegSymbol(
        allEighteen,
        "DUMMY0000001",
        "aircraft_information",
        "aircraft_status",
        "not-a-number"
      );

      normalizeAircraftList(raw);

      expect(spy).toHaveBeenCalledOnce();
      const [message, errorArg, context] = spy.mock.calls[0] as [string, unknown, Record<string, unknown>];
      expect(message).toContain("1/18");
      expect(errorArg).toBeUndefined();
      expect(context).toMatchObject({
        route: "normalizeAircraftList",
        droppedEntries: [
          {
            index: 0,
            issuePaths: expect.arrayContaining(["aircraft_information.aircraft_status"]),
          },
        ],
      });
      // 登録記号・受信値そのもの (不正値 "not-a-number" を含む) がログに含まれないことを確認
      const serializedContext = JSON.stringify(context);
      expect(serializedContext).not.toContain("DUMMY0000001");
      expect(serializedContext).not.toContain("not-a-number");
    });

    it("test_parse_does_not_call_logger_when_all_entries_parse_successfully", () => {
      const spy = vi.spyOn(logger, "error").mockImplementation(() => {});

      normalizeAircraftList(accountAResponse);

      expect(spy).not.toHaveBeenCalled();
    });
  });
});
