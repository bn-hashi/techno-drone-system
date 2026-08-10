import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { normalizeAircraftList, normalizeAircraftListWithDiagnostics } from "@/lib/dips/aircraftListSchema";
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

/** 3アカウント分 (A/B/D) を合成した全18機体フィクスチャの件数。マジックナンバー化を避ける */
const ALL_ACCOUNTS_AIRCRAFT_COUNT = 18;

/**
 * 3アカウント分 (A/B/D) の全18機体フィクスチャを合成する。件数のずれはテストの前提
 * そのものが崩れていることを意味するため、expect (アサーション) ではなく Arrange の
 * 一部として Error で早期に気付けるようにする (CodeRabbit 指摘: フィクスチャ前提の
 * 確認をテスト本体のアサーションから分離する)。
 */
function buildAllAccountsAircraftsFixture(): unknown[] {
  const all = [...accountAResponse, ...accountBResponse, ...accountDResponse];
  if (all.length !== ALL_ACCOUNTS_AIRCRAFT_COUNT) {
    throw new Error(
      `テストフィクスチャの前提が崩れています (期待: ${ALL_ACCOUNTS_AIRCRAFT_COUNT}機, 実際: ${all.length}機)`
    );
  }
  return all;
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
    // 削除したキーのため値そのものが存在せず、メッセージにはキー名のみが含まれる
    const broken = [minimalValidRawEntry()];
    delete (broken[0].aircraft_information as Record<string, unknown>).registration_code;

    expect(() => normalizeAircraftList(broken)).toThrow(/registration_code/);
  });

  it("test_parse_error_message_does_not_contain_sibling_field_values", () => {
    const broken = [minimalValidRawEntry()];
    delete (broken[0].aircraft_information as Record<string, unknown>).registration_code;

    try {
      normalizeAircraftList(broken);
    } catch (error) {
      expect((error as DipsApiError).message).not.toContain("MANUFACT99");
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
    // (codeNumber の isFinite ガード分岐)
    const broken = minimalValidRawEntry({ aircraft_status: "not-a-number" });

    expect(() => normalizeAircraftList([broken])).toThrow(DipsApiError);
  });

  it("test_parse_normalizes_empty_aircraft_status_to_null", () => {
    // 修正2回帰テスト (A2): aircraft_status を含む codeNumber 系フィールドの null 寛容化を
    // 全フィールドへ横展開したことで、空文字は (かつてのようにエラーにするのではなく)
    // null に正規化されるようになった。`Number("") === 0` によって黙って 0 (有効な機体) に
    // 化けるわけではないことが要点であり、null であることを直接確認する。
    const entry = minimalValidRawEntry({ aircraft_status: "" });

    const result = normalizeAircraftList([entry]);

    expect(result[0].uaStatus).toBeNull();
  });

  it.each([["Infinity"], ["-Infinity"]])(
    "test_parse_throws_when_aircraft_weight_is_the_string_%s",
    (value) => {
      // 回帰テスト (A1): Number.isNaN だけでは Number("Infinity") = Infinity を素通り
      // させてしまい、Math.round(Infinity*1000) → JSON.stringify で null 化し、
      // クライアント側の z.number() 検証で不可解に拒否される事故につながっていた。
      // codeNumber は Infinity/-Infinity も明示的に弾く。
      const broken = minimalValidRawEntry({ aircraft_weight: value });

      expect(() => normalizeAircraftList([broken])).toThrow(DipsApiError);
    }
  );

  it("test_parse_throws_when_erase_reason_number_is_infinity", () => {
    // nullableCodeNumber 側にも同じ Infinity ガードを適用している (A1 の横展開)
    const broken = minimalValidRawEntry({ erase_reason_number: "Infinity" });

    expect(() => normalizeAircraftList([broken])).toThrow(DipsApiError);
  });

  it("test_parse_throws_when_erase_reason_number_is_non_numeric_string", () => {
    // 異常系: erase_reason_number が非数値文字列で返ってきた場合はパースエラーになる
    // (nullableCodeNumber の isFinite ガード分岐)
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

  describe("A2: null寛容化のcodeNumber系全フィールドへの横展開", () => {
    it("test_parse_normalizes_null_manufacturing_category_to_null", () => {
      const entry = minimalValidRawEntry({ manufacturing_category: null });

      const result = normalizeAircraftList([entry]);

      expect(result[0].manufactureCategory).toBeNull();
    });

    it("test_parse_normalizes_null_aircraft_type_to_null", () => {
      const entry = minimalValidRawEntry({ aircraft_type: null });

      const result = normalizeAircraftList([entry]);

      expect(result[0].uaType).toBeNull();
    });

    it("test_parse_normalizes_null_rid_type_to_null", () => {
      const entry = minimalValidRawEntry({ rid_type: null });

      const result = normalizeAircraftList([entry]);

      expect(result[0].remoteIdType).toBeNull();
    });

    it("test_parse_normalizes_null_aircraft_weight_to_null", () => {
      const entry = minimalValidRawEntry({ aircraft_weight: null });

      const result = normalizeAircraftList([entry]);

      expect(result[0].weightKg).toBeNull();
    });

    it("test_parse_normalizes_null_maximum_takeoff_weight_to_null", () => {
      const entry = minimalValidRawEntry({ maximum_takeoff_weight: null });

      const result = normalizeAircraftList([entry]);

      expect(result[0].maxTakeoffWeightKg).toBeNull();
    });

    it("test_parse_normalizes_null_owner_classification_to_null", () => {
      const entry = minimalValidRawEntry();
      (entry.owner_information as Record<string, unknown>).owner_classification = null;

      const result = normalizeAircraftList([entry]);

      expect(result[0].ownerCategory).toBeNull();
    });

    it("test_parse_normalizes_null_user_classification_to_empty_string_individual_default", () => {
      // 最重要の回帰テスト (A2): user_classification は「空文字 = 個人」が正常値の
      // ドキュメント上の既定であり (別紙1 項番60)、実 API が null を返すケースを
      // 個人アカウントの機体として扱えないと個人アカウントのほぼ全機が消える。
      const entry = minimalValidRawEntry();
      (entry.user_information as Record<string, unknown>).user_classification = null;

      const result = normalizeAircraftList([entry]);

      expect(result[0].userCategory).toBe("");
    });

    it("test_parse_normalizes_missing_user_classification_key_to_empty_string", () => {
      const entry = minimalValidRawEntry();
      delete (entry.user_information as Record<string, unknown>).user_classification;

      const result = normalizeAircraftList([entry]);

      expect(result[0].userCategory).toBe("");
    });
  });

  it("test_parse_error_message_includes_received_type_when_response_is_not_an_array", () => {
    // 回帰テスト (C2): 配列でないレスポンスのエラーメッセージが「(対象キー: )」と
    // 空になっており切り分け情報が残らなかった。受信した型名を含めるようにする。
    expect(() => normalizeAircraftList({ aircrafts: [] })).toThrow(/受信した型: object/);
  });

  describe("エントリ単位のフォールバック (1機の異常値が他機体を巻き込まないこと)", () => {
    afterEach(() => {
      vi.restoreAllMocks();
    });

    it("test_parse_keeps_seventeen_aircrafts_when_one_of_eighteen_has_invalid_aircraft_status", () => {
      // コードレビュー指摘 (情報): 18機中1機の異常値でアカウント全体が502落ちしていた構造の回帰テスト
      const raw = corruptFieldByRegSymbol(
        buildAllAccountsAircraftsFixture(),
        "DUMMY0000001",
        "aircraft_information",
        "aircraft_status",
        "not-a-number"
      );

      const result = normalizeAircraftList(raw);

      expect(result).toHaveLength(17);
    });

    it("test_parse_excludes_the_aircraft_with_invalid_aircraft_status", () => {
      const raw = corruptFieldByRegSymbol(
        buildAllAccountsAircraftsFixture(),
        "DUMMY0000001",
        "aircraft_information",
        "aircraft_status",
        "not-a-number"
      );

      const result = normalizeAircraftList(raw);

      expect(result.some((a) => a.regSymbol === "DUMMY0000001")).toBe(false);
    });

    it("test_parse_drops_only_the_entry_with_invalid_manufacturing_category_count", () => {
      // codeNumber を使う他フィールドの代表1: aircraft_information 直下のコード値。
      // null は A2 で寛容化されたため、依然として不正な非数値文字列を使う。
      const raw = corruptFieldByRegSymbol(
        accountAResponse,
        "DUMMY0000002",
        "aircraft_information",
        "manufacturing_category",
        "not-a-number"
      );

      const result = normalizeAircraftList(raw);

      expect(result).toHaveLength(accountAResponse.length - 1);
    });

    it("test_parse_excludes_the_aircraft_with_invalid_manufacturing_category", () => {
      const raw = corruptFieldByRegSymbol(
        accountAResponse,
        "DUMMY0000002",
        "aircraft_information",
        "manufacturing_category",
        "not-a-number"
      );

      const result = normalizeAircraftList(raw);

      expect(result.some((a) => a.regSymbol === "DUMMY0000002")).toBe(false);
    });

    it("test_parse_retains_other_aircrafts_when_one_has_invalid_manufacturing_category", () => {
      const raw = corruptFieldByRegSymbol(
        accountAResponse,
        "DUMMY0000002",
        "aircraft_information",
        "manufacturing_category",
        "not-a-number"
      );

      const result = normalizeAircraftList(raw);

      expect(result.some((a) => a.regSymbol === "DUMMY0000001")).toBe(true);
    });

    it("test_parse_drops_only_the_entry_with_invalid_owner_classification_count", () => {
      // codeNumber を使う他フィールドの代表2: owner_information (ネスト構造) 側のコード値
      const raw = corruptFieldByRegSymbol(
        accountAResponse,
        "DUMMY0000003",
        "owner_information",
        "owner_classification",
        "not-a-number"
      );

      const result = normalizeAircraftList(raw);

      expect(result).toHaveLength(accountAResponse.length - 1);
    });

    it("test_parse_excludes_the_aircraft_with_invalid_owner_classification", () => {
      const raw = corruptFieldByRegSymbol(
        accountAResponse,
        "DUMMY0000003",
        "owner_information",
        "owner_classification",
        "not-a-number"
      );

      const result = normalizeAircraftList(raw);

      expect(result.some((a) => a.regSymbol === "DUMMY0000003")).toBe(false);
    });

    it("test_parse_drops_only_the_entry_with_invalid_aircraft_weight_count", () => {
      // codeNumber を使う他フィールドの代表3: 重量系 (数値であることが前提の項目)
      const raw = corruptFieldByRegSymbol(
        accountAResponse,
        "DUMMY0000004",
        "aircraft_information",
        "aircraft_weight",
        "not-a-number"
      );

      const result = normalizeAircraftList(raw);

      expect(result).toHaveLength(accountAResponse.length - 1);
    });

    it("test_parse_excludes_the_aircraft_with_invalid_aircraft_weight", () => {
      const raw = corruptFieldByRegSymbol(
        accountAResponse,
        "DUMMY0000004",
        "aircraft_information",
        "aircraft_weight",
        "not-a-number"
      );

      const result = normalizeAircraftList(raw);

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

    describe("パース失敗を記録するログの内容", () => {
      let messageArg: string;
      let errorArg: unknown;
      let context: Record<string, unknown> | undefined;
      let spy: ReturnType<typeof vi.spyOn>;

      beforeEach(() => {
        spy = vi.spyOn(logger, "error").mockImplementation(() => {});
        const raw = corruptFieldByRegSymbol(
          buildAllAccountsAircraftsFixture(),
          "DUMMY0000001",
          "aircraft_information",
          "aircraft_status",
          "not-a-number"
        );

        normalizeAircraftList(raw);

        [messageArg, errorArg, context] = spy.mock.calls[0] as [
          string,
          unknown,
          Record<string, unknown>,
        ];
      });

      it("test_parse_logs_dropped_entry_exactly_once", () => {
        expect(spy).toHaveBeenCalledOnce();
      });

      it("test_parse_log_message_contains_dropped_and_total_count", () => {
        expect(messageArg).toContain("1/18");
      });

      it("test_parse_log_error_argument_is_undefined", () => {
        expect(errorArg).toBeUndefined();
      });

      it("test_parse_log_context_contains_route_and_dropped_entries", () => {
        expect(context).toMatchObject({
          route: "normalizeAircraftList",
          droppedEntries: [
            {
              index: 0,
              issuePaths: expect.arrayContaining(["aircraft_information.aircraft_status"]),
            },
          ],
        });
      });

      it("test_parse_log_does_not_contain_registration_code", () => {
        expect(JSON.stringify(context)).not.toContain("DUMMY0000001");
      });

      it("test_parse_log_does_not_contain_raw_invalid_value", () => {
        expect(JSON.stringify(context)).not.toContain("not-a-number");
      });
    });

    it("test_parse_does_not_call_logger_when_all_entries_parse_successfully", () => {
      const spy = vi.spyOn(logger, "error").mockImplementation(() => {});

      normalizeAircraftList(accountAResponse);

      expect(spy).not.toHaveBeenCalled();
    });
  });
});

describe("normalizeAircraftListWithDiagnostics", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("test_diagnostics_reports_zero_excluded_when_all_entries_parse", () => {
    const result = normalizeAircraftListWithDiagnostics(accountAResponse);

    expect(result.excludedCount).toBe(0);
  });

  it("test_diagnostics_reports_excluded_count_matching_dropped_entries", () => {
    // C3 回帰テスト: 除外件数を上位層 (API レスポンス → UI) へ伝搬させることで
    // 「除外があったのに0件と表示する」誤表示を防ぐ
    vi.spyOn(logger, "error").mockImplementation(() => {});
    const raw = corruptFieldByRegSymbol(
      accountAResponse,
      "DUMMY0000002",
      "aircraft_information",
      "manufacturing_category",
      "not-a-number"
    );

    const result = normalizeAircraftListWithDiagnostics(raw);

    expect(result.excludedCount).toBe(1);
  });

  it("test_diagnostics_returns_same_aircrafts_as_normalizeAircraftList", () => {
    const result = normalizeAircraftListWithDiagnostics(accountAResponse);

    expect(result.aircrafts).toEqual(normalizeAircraftList(accountAResponse));
  });
});
