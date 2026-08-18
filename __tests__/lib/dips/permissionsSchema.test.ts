import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { normalizePermissionsWithDiagnostics } from "@/lib/dips/permissionsSchema";
import { DipsApiError } from "@/lib/dips/errors";
import { logger } from "@/lib/logger";

/**
 * 最小限の有効な生レスポンス1件 (設定通知書 R08-DRS-0005 別紙3 のレスポンスサンプルに
 * 準拠。値はすべてテスト用のダミー)。
 */
function minimalValidPermission(overrides: Record<string, unknown> = {}) {
  return {
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
    ...overrides,
  };
}

describe("normalizePermissionsWithDiagnostics", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ─── 正常系 ─────────────────────────────────────────────────────────────────

  it("test_parse_returns_permission_with_expected_reception_number", () => {
    const result = normalizePermissionsWithDiagnostics({
      permissions: [minimalValidPermission()],
    });

    expect(result.permissions[0].receptionNumber).toBe("P000000001");
  });

  it("test_parse_returns_zero_excluded_when_all_entries_parse", () => {
    const result = normalizePermissionsWithDiagnostics({
      permissions: [minimalValidPermission()],
    });

    expect(result.excludedCount).toBe(0);
  });

  it("test_parse_returns_empty_array_when_account_has_no_permissions", () => {
    // 空配列は「許可情報なし」の正当な応答であり、エラーにしない
    const result = normalizePermissionsWithDiagnostics({ permissions: [] });

    expect(result).toEqual({ permissions: [], excludedCount: 0 });
  });

  it("test_parse_preserves_flight_routes", () => {
    const result = normalizePermissionsWithDiagnostics({
      permissions: [minimalValidPermission()],
    });

    expect(result.permissions[0].flightRoutes).toEqual([
      { routeName: "テスト経路", routeLatlons: ["000000 0000000"] },
    ]);
  });

  it("test_parse_preserves_ua_infos", () => {
    const result = normalizePermissionsWithDiagnostics({
      permissions: [minimalValidPermission()],
    });

    expect(result.permissions[0].uaInfos).toEqual([
      { uaMaker: "テスト製造者", uaName: "テスト型式", regSymbol: "999999999999" },
    ]);
  });

  it("test_parse_preserves_boolean_flags_as_is", () => {
    const result = normalizePermissionsWithDiagnostics({
      permissions: [minimalValidPermission({ nightOperation: true })],
    });

    expect(result.permissions[0].nightOperation).toBe(true);
  });

  // ─── permissionNumber2 の null 寛容化 ────────────────────────────────────────

  it("test_parse_keeps_permission_number2_as_null_when_response_has_explicit_null", () => {
    const result = normalizePermissionsWithDiagnostics({
      permissions: [minimalValidPermission({ permissionNumber2: null })],
    });

    expect(result.permissions[0].permissionNumber2).toBeNull();
  });

  it("test_parse_normalizes_missing_permission_number2_key_to_null", () => {
    const entry = minimalValidPermission();
    delete (entry as Record<string, unknown>).permissionNumber2;

    const result = normalizePermissionsWithDiagnostics({ permissions: [entry] });

    expect(result.permissions[0].permissionNumber2).toBeNull();
  });

  it("test_parse_keeps_permission_number2_value_when_present", () => {
    const result = normalizePermissionsWithDiagnostics({
      permissions: [minimalValidPermission({ permissionNumber2: "東空運航TEST02" })],
    });

    expect(result.permissions[0].permissionNumber2).toBe("東空運航TEST02");
  });

  // ─── 寛容パース: 未知フィールド・個人情報の遮断 ───────────────────────────────

  it("test_parse_ignores_unknown_top_level_key", () => {
    expect(() =>
      normalizePermissionsWithDiagnostics({
        permissions: [minimalValidPermission()],
        futureExtensionField: "unexpected",
      })
    ).not.toThrow();
  });

  it("test_parse_ignores_unknown_entry_level_key", () => {
    expect(() =>
      normalizePermissionsWithDiagnostics({
        permissions: [minimalValidPermission({ applicantName: "PIIプローブ申請者" })],
      })
    ).not.toThrow();
  });

  it("test_parse_drops_unknown_field_values_not_defined_in_schema", () => {
    // 個人情報の遮断点: スキーマに定義していないキーは自動的に破棄される (strip)
    const result = normalizePermissionsWithDiagnostics({
      permissions: [minimalValidPermission({ applicantName: "PIIプローブ申請者" })],
    });

    expect(JSON.stringify(result)).not.toContain("PIIプローブ申請者");
  });

  // ─── レスポンス全体の形が不正 ─────────────────────────────────────────────────

  it("test_parse_throws_when_response_has_no_permissions_key", () => {
    expect(() => normalizePermissionsWithDiagnostics({})).toThrow(DipsApiError);
  });

  it("test_parse_throws_when_permissions_is_not_an_array", () => {
    expect(() => normalizePermissionsWithDiagnostics({ permissions: "not-an-array" })).toThrow(
      DipsApiError
    );
  });

  it("test_parse_error_message_includes_received_type_when_response_is_not_an_object", () => {
    expect(() => normalizePermissionsWithDiagnostics(["unexpected-array"])).toThrow(
      /受信した型: array/
    );
  });

  // ─── エントリ単位のフォールバック (1件の異常値が他の許可を巻き込まないこと) ─────

  describe("エントリ単位のフォールバック", () => {
    it("test_parse_keeps_the_other_permission_when_one_of_two_has_invalid_reception_number", () => {
      const valid = minimalValidPermission({ receptionNumber: "P000000001" });
      const broken = minimalValidPermission({ receptionNumber: 12345 }); // 数値は不正 (string 期待)

      const result = normalizePermissionsWithDiagnostics({ permissions: [valid, broken] });

      expect(result.permissions.map((p) => p.receptionNumber)).toEqual(["P000000001"]);
    });

    it("test_parse_reports_excluded_count_one_when_one_of_two_entries_is_invalid", () => {
      const valid = minimalValidPermission({ receptionNumber: "P000000001" });
      const broken = minimalValidPermission({ receptionNumber: 12345 });

      const result = normalizePermissionsWithDiagnostics({ permissions: [valid, broken] });

      expect(result.excludedCount).toBe(1);
    });

    it("test_parse_drops_entry_with_invalid_boolean_flag", () => {
      // 有効な1件と組み合わせる (壊れた1件だけだと「全件失敗」パスに入ってしまうため)
      const valid = minimalValidPermission({ receptionNumber: "P000000001" });
      const broken = minimalValidPermission({
        receptionNumber: "P000000002",
        nightOperation: "yes", // 文字列は不正 (boolean 期待)
      });

      const result = normalizePermissionsWithDiagnostics({ permissions: [valid, broken] });

      expect({
        receptionNumbers: result.permissions.map((p) => p.receptionNumber),
        excludedCount: result.excludedCount,
      }).toEqual({ receptionNumbers: ["P000000001"], excludedCount: 1 });
    });

    it("test_parse_drops_entry_with_invalid_ua_infos_shape", () => {
      const valid = minimalValidPermission({ receptionNumber: "P000000001" });
      const broken = minimalValidPermission({
        receptionNumber: "P000000002",
        uaInfos: [{ uaMaker: "X" }], // uaName/regSymbol 欠落
      });

      const result = normalizePermissionsWithDiagnostics({ permissions: [valid, broken] });

      expect({
        receptionNumbers: result.permissions.map((p) => p.receptionNumber),
        excludedCount: result.excludedCount,
      }).toEqual({ receptionNumbers: ["P000000001"], excludedCount: 1 });
    });

    it("test_parse_throws_when_all_entries_fail_to_parse", () => {
      // 全件失敗時は「許可情報0件」と誤解させる空配列ではなく DipsApiError を投げる
      const broken1 = minimalValidPermission({ receptionNumber: 1 });
      const broken2 = minimalValidPermission({ receptionNumber: 2 });

      expect(() =>
        normalizePermissionsWithDiagnostics({ permissions: [broken1, broken2] })
      ).toThrow(DipsApiError);
    });

    it("test_parse_all_entries_failed_error_message_contains_issue_key", () => {
      const broken = minimalValidPermission({ receptionNumber: 12345 });

      expect(() => normalizePermissionsWithDiagnostics({ permissions: [broken] })).toThrow(
        /receptionNumber/
      );
    });
  });

  // ─── ログ (個人情報を出さないこと) ────────────────────────────────────────────

  describe("パース失敗を記録するログの内容", () => {
    let messageArg: string;
    let errorArg: unknown;
    let context: Record<string, unknown> | undefined;
    let spy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      spy = vi.spyOn(logger, "error").mockImplementation(() => {});
      const valid = minimalValidPermission({ receptionNumber: "P000000001" });
      const broken = minimalValidPermission({
        receptionNumber: "PIIプローブ受付番号",
        nightOperation: "not-a-boolean",
      });

      normalizePermissionsWithDiagnostics({ permissions: [valid, broken] });

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
      expect(messageArg).toContain("1/2");
    });

    it("test_parse_log_error_argument_is_undefined", () => {
      expect(errorArg).toBeUndefined();
    });

    it("test_parse_log_context_contains_route_and_dropped_entry_index", () => {
      expect(context).toMatchObject({
        route: "normalizePermissions",
        droppedEntries: [
          {
            index: 1,
            issuePaths: expect.arrayContaining(["nightOperation"]),
          },
        ],
      });
    });

    it("test_parse_log_does_not_contain_raw_reception_number_value", () => {
      // 落としたエントリの値そのもの (個人情報を含みうる) はログに残さない。
      // ログにはインデックスと Zod のキー名のみが載ることを確認する
      expect(JSON.stringify(context)).not.toContain("PIIプローブ受付番号");
    });

    it("test_parse_log_does_not_contain_raw_invalid_value", () => {
      expect(JSON.stringify(context)).not.toContain("not-a-boolean");
    });
  });

  it("test_parse_does_not_call_logger_when_all_entries_parse_successfully", () => {
    const spy = vi.spyOn(logger, "error").mockImplementation(() => {});

    normalizePermissionsWithDiagnostics({ permissions: [minimalValidPermission()] });

    expect(spy).not.toHaveBeenCalled();
  });
});
