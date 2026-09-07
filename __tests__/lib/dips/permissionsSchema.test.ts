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

  it("test_parse_normalizes_empty_string_permission_number2_to_null", () => {
    // B4 差し戻し: JSDoc は「空文字・null・キー欠落を null に正規化する」と書かれていたが、
    // 実装は null/undefined しか変換していなかった (契約と実装の不一致)。実装を JSDoc に
    // 合わせる
    const result = normalizePermissionsWithDiagnostics({
      permissions: [minimalValidPermission({ permissionNumber2: "" })],
    });

    expect(result.permissions[0].permissionNumber2).toBeNull();
  });

  // ─── boolean フラグの "1"/"0" 文字列受理 (B1 差し戻し) ───────────────────────

  it("test_parse_accepts_string_1_as_true_for_boolean_flag", () => {
    // このコードベースの DIPS boolean 慣習は "1"/"0" の文字列 (services/dipsService.ts が
    // 送信時に boolean → "1"/"0" へ変換しているのと対称)。DIPS が "1"/"0" を返すと
    // z.boolean() が全エントリを弾いていた
    const result = normalizePermissionsWithDiagnostics({
      permissions: [minimalValidPermission({ nightOperation: "1" })],
    });

    expect(result.permissions[0].nightOperation).toBe(true);
  });

  it("test_parse_accepts_string_0_as_false_for_boolean_flag", () => {
    const result = normalizePermissionsWithDiagnostics({
      permissions: [minimalValidPermission({ nightOperation: "0" })],
    });

    expect(result.permissions[0].nightOperation).toBe(false);
  });

  it("test_parse_accepts_number_1_as_true_for_boolean_flag", () => {
    // F4 差し戻し: aircraftListSchema.ts の RAW_CODE は文字列・数値の両方を受理しているが、
    // flexibleBoolean は "1"/"0" の文字列しか受理しておらず、数値で返る経路だけ弾かれていた
    const result = normalizePermissionsWithDiagnostics({
      permissions: [minimalValidPermission({ nightOperation: 1 })],
    });

    expect(result.permissions[0].nightOperation).toBe(true);
  });

  it("test_parse_accepts_number_0_as_false_for_boolean_flag", () => {
    const result = normalizePermissionsWithDiagnostics({
      permissions: [minimalValidPermission({ nightOperation: 0 })],
    });

    expect(result.permissions[0].nightOperation).toBe(false);
  });

  it("test_parse_does_not_exclude_entry_when_all_boolean_flags_are_string_1_or_0", () => {
    // 回帰テスト: 修正前は9個のフラグ全てが "1"/"0" 文字列で返るエントリが必ず
    // 除外され (worst case: 全エントリが該当するとアカウントごと 502 になる)、
    // 修正後は除外されずそのまま含まれることを確認する
    const allStringFlags = minimalValidPermission({
      aboveDenselyInhabitedDistricts: "1",
      moreThan150mAboveTheGround: "0",
      aroundAirports: "1",
      lessThan30m: "0",
      overEventSites: "1",
      nightOperation: "0",
      beyondVisualLineOfSight: "1",
      transportHazardousMaterials: "0",
      dropObjects: "1",
    });

    const result = normalizePermissionsWithDiagnostics({ permissions: [allStringFlags] });

    expect({
      excludedCount: result.excludedCount,
      aboveDenselyInhabitedDistricts: result.permissions[0]?.aboveDenselyInhabitedDistricts,
      dropObjects: result.permissions[0]?.dropObjects,
    }).toEqual({ excludedCount: 0, aboveDenselyInhabitedDistricts: true, dropObjects: true });
  });

  // ─── flightRoutes/uaInfos の null・欠落の空配列化 (B3 差し戻し) ────────────────

  it("test_parse_treats_null_flight_routes_as_empty_array", () => {
    // 包括申請で flightRoutes: null が返るとその許可が丸ごと落ちていた
    const result = normalizePermissionsWithDiagnostics({
      permissions: [minimalValidPermission({ flightRoutes: null })],
    });

    expect({
      excludedCount: result.excludedCount,
      flightRoutes: result.permissions[0]?.flightRoutes,
    }).toEqual({ excludedCount: 0, flightRoutes: [] });
  });

  it("test_parse_treats_missing_ua_infos_key_as_empty_array", () => {
    const entry = minimalValidPermission();
    delete (entry as Record<string, unknown>).uaInfos;

    const result = normalizePermissionsWithDiagnostics({ permissions: [entry] });

    expect({
      excludedCount: result.excludedCount,
      uaInfos: result.permissions[0]?.uaInfos,
    }).toEqual({ excludedCount: 0, uaInfos: [] });
  });

  // ─── permissions 本体の null は正当なゼロ件、キー欠落はエラー (F1 差し戻しで区別) ──
  //
  // 2026-08-26 (B2) は空アカウント ({} や { permissions: null }) の 502 化を防ぐため
  // キー欠落も null と同じ「正当なゼロ件」として飲み込んだが、これは A3 でクライアント
  // 境界を固めて潰したはずの「キー名変更・接続先誤りが0件として静かに成功する」失敗
  // モードをサーバー境界で復活させていた。2026-08-28 (F1) でキー欠落とnull/[]を区別する。

  it("test_parse_throws_when_permissions_key_is_missing", () => {
    // {} は「permissions というキー自体が存在しない」レスポンスであり、DIPS 側の
    // キー名変更や接続先誤りの疑いがある。正当なゼロ件 (null/[]) とは区別してエラーにする
    expect(() => normalizePermissionsWithDiagnostics({})).toThrow(DipsApiError);
  });

  it("test_parse_missing_permissions_key_error_message_mentions_the_key_name", () => {
    expect(() => normalizePermissionsWithDiagnostics({})).toThrow(/permissions/);
  });

  it("test_parse_returns_empty_array_when_permissions_is_explicitly_null", () => {
    // 空アカウントが { permissions: null } を返すのは正当なゼロ件であり、
    // キー欠落 (仕様変更の疑い) とは区別してエラーにしない
    const result = normalizePermissionsWithDiagnostics({ permissions: null });

    expect(result).toEqual({ permissions: [], excludedCount: 0 });
  });

  it("test_parse_returns_empty_array_when_permissions_is_explicitly_empty_array", () => {
    const result = normalizePermissionsWithDiagnostics({ permissions: [] });

    expect(result).toEqual({ permissions: [], excludedCount: 0 });
  });

  // ─── 画面に表示しないフィールドで許可を落とさない (F5 差し戻し) ────────────────

  it("test_parse_does_not_drop_entry_when_permission_date_has_unexpected_type", () => {
    // permissionDate は DipsPermissionsPanel.tsx が画面に表示しないフィールドのため、
    // 想定外の型 (ここでは数値) が来ても許可自体を落とさない
    const result = normalizePermissionsWithDiagnostics({
      permissions: [minimalValidPermission({ permissionDate: 20260101 })],
    });

    expect({
      excludedCount: result.excludedCount,
      receptionNumber: result.permissions[0]?.receptionNumber,
    }).toEqual({ excludedCount: 0, receptionNumber: "P000000001" });
  });

  it("test_parse_normalizes_unexpected_permission_date_type_to_null", () => {
    const result = normalizePermissionsWithDiagnostics({
      permissions: [minimalValidPermission({ permissionDate: 20260101 })],
    });

    expect(result.permissions[0]?.permissionDate).toBeNull();
  });

  it("test_parse_does_not_drop_entry_when_permission_date_key_is_missing", () => {
    // 2026-09-02 差し戻し (H1): Zod v4 は z.object() 内の z.unknown() のキーも必須扱いに
    // するため、permissionDate キー自体が無い (値が undefined ではなくキーがそもそも
    // 存在しない) レスポンスは "invalid_type: expected nonoptional" で弾かれ、F5 の
    // 「表示しないフィールドで許可を落とさない」が effectively 効いていなかった。
    // DIPS が permissionDate を返さない実装だと全件がこの経路で落ち、アカウント全体が
    // 502 になる実害があったため、値が null/型不正な場合 (上記2テスト) だけでなく
    // キー自体が無い場合も許可を落とさないことを確認する。
    const entry = minimalValidPermission();
    delete (entry as Record<string, unknown>).permissionDate;

    const result = normalizePermissionsWithDiagnostics({ permissions: [entry] });

    expect({
      excludedCount: result.excludedCount,
      permissionDate: result.permissions[0]?.permissionDate,
    }).toEqual({ excludedCount: 0, permissionDate: null });
  });

  it("test_parse_drops_only_the_invalid_route_when_one_flight_route_has_unexpected_route_name_type", () => {
    // flightRoutes は画面に一切表示しないフィールドのため、1経路の型不正で許可全体を
    // 落とすのは不釣り合い。パースできる経路だけを残し、許可自体は維持する
    const validRoute = { routeName: "テスト経路", routeLatlons: ["000000 0000000"] };
    const invalidRoute = { routeName: 12345, routeLatlons: ["111111 1111111"] };
    const result = normalizePermissionsWithDiagnostics({
      permissions: [minimalValidPermission({ flightRoutes: [validRoute, invalidRoute] })],
    });

    expect({
      excludedCount: result.excludedCount,
      flightRoutes: result.permissions[0]?.flightRoutes,
    }).toEqual({ excludedCount: 0, flightRoutes: [validRoute] });
  });

  it("test_parse_does_not_drop_entry_when_all_flight_routes_have_invalid_route_latlons_type", () => {
    const invalidRoute = { routeName: "テスト経路", routeLatlons: [12345] };
    const result = normalizePermissionsWithDiagnostics({
      permissions: [minimalValidPermission({ flightRoutes: [invalidRoute] })],
    });

    expect({
      excludedCount: result.excludedCount,
      receptionNumber: result.permissions[0]?.receptionNumber,
      flightRoutes: result.permissions[0]?.flightRoutes,
    }).toEqual({ excludedCount: 0, receptionNumber: "P000000001", flightRoutes: [] });
  });

  it("test_parse_does_not_drop_entry_when_flight_routes_key_is_missing", () => {
    // 2026-09-02 差し戻し (H1): flightRoutes も permissionDate と同じ z.unknown().transform()
    // の形だったため、キー自体が無いレスポンスで同じ "invalid_type: expected nonoptional" が
    // 発生し許可が丸ごと除外されていた。null 値 (test_parse_treats_null_flight_routes_as_
    // empty_array) だけでなくキー欠落でも空配列に正規化され、許可自体は残ることを確認する。
    const entry = minimalValidPermission();
    delete (entry as Record<string, unknown>).flightRoutes;

    const result = normalizePermissionsWithDiagnostics({ permissions: [entry] });

    expect({
      excludedCount: result.excludedCount,
      flightRoutes: result.permissions[0]?.flightRoutes,
    }).toEqual({ excludedCount: 0, flightRoutes: [] });
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
  // (permissions キーの欠落・null は「許可情報なし」の空状態として扱う。B2 参照)

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

  it("test_parse_error_message_includes_permissions_key_when_only_permissions_value_is_invalid", () => {
    // C2 差し戻し: describeReceivedType(raw) はトップレベル (常に "object") にしか
    // 適用されておらず、"permissions" キーの値だけが不正な場合は診断価値がなかった。
    // Zod の issue (パス・コード) を含めることで、どのキーが原因か分かるようにする
    expect(() => normalizePermissionsWithDiagnostics({ permissions: "not-an-array" })).toThrow(
      /permissions/
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

  describe("エントリ自体がオブジェクトでない場合のログ内容 (C1)", () => {
    // Zod の issue.path はエントリ自体がオブジェクトでないとき空配列になり、
    // 以前は issuePaths が [""] (空文字) になっていた。「対象キー: 」と空欄になり、
    // IP 制限で再試行しにくい本番で何も手がかりが得られなかった
    it("test_parse_log_issue_path_is_not_empty_when_entry_is_not_an_object", () => {
      const spy = vi.spyOn(logger, "error").mockImplementation(() => {});
      const valid = minimalValidPermission({ receptionNumber: "P000000001" });
      const nonObjectEntry = "unexpected-string-entry";

      normalizePermissionsWithDiagnostics({ permissions: [valid, nonObjectEntry] });

      const [, , context] = spy.mock.calls[0] as [string, unknown, Record<string, unknown>];
      const droppedEntries = context.droppedEntries as Array<{ issuePaths: string[] }>;

      expect(droppedEntries[0].issuePaths).not.toEqual([""]);
    });

    it("test_parse_log_issue_path_includes_received_type_when_entry_is_not_an_object", () => {
      const spy = vi.spyOn(logger, "error").mockImplementation(() => {});
      const valid = minimalValidPermission({ receptionNumber: "P000000001" });
      const nonObjectEntry = "unexpected-string-entry";

      normalizePermissionsWithDiagnostics({ permissions: [valid, nonObjectEntry] });

      const [, , context] = spy.mock.calls[0] as [string, unknown, Record<string, unknown>];
      const droppedEntries = context.droppedEntries as Array<{ issuePaths: string[] }>;

      expect(droppedEntries[0].issuePaths[0]).toContain("string");
    });
  });

  it("test_parse_does_not_call_logger_when_all_entries_parse_successfully", () => {
    const spy = vi.spyOn(logger, "error").mockImplementation(() => {});

    normalizePermissionsWithDiagnostics({ permissions: [minimalValidPermission()] });

    expect(spy).not.toHaveBeenCalled();
  });
});
