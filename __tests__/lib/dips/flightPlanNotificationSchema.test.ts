// @vitest-environment node
import { describe, it, expect } from "vitest";
import { normalizeFlightPlanNotificationResult } from "@/lib/dips/flightPlanNotificationSchema";
import { DipsAcceptedButUnreadableResultError } from "@/lib/dips/errors";

/**
 * ガイドライン §2.3.8 のレスポンスボディサンプル4版
 * (`_orchestrator/results/quick/20260908-fpr-guideline-2.3.8-samples.txt` 326-433行)。
 * テストデータは必ずここからコピーする (手で書き直さない。今回の事故自体が
 * 「ガイドラインを読まずに型を書いた」ことに起因するため。2026-09-11 planner計画 §7-2)。
 */
const sampleNoDuplicateInfo = [
  {
    flightPlanInfoRegistrationResult: {
      flightPlanId: "AAAAAAAAAAAAAAAAAAA.FP20221205042709013.001",
      flightPlanRegistrationResult: "登録完了",
      flightPlanRegistrationDatetime: "2022/12/05 10:27",
      existOtherFlightRoutesCount: 0,
    },
  },
];

const sampleZeroDuplicates = [
  {
    flightPlanInfoRegistrationResult: {
      flightPlanId: "AAAAAAAAAAAAAAAAAAA.FP20221205042709013.001",
      flightPlanRegistrationResult: "登録完了",
      flightPlanRegistrationDatetime: "2022/12/05 10:27",
      existOtherFlightRoutesCount: 0,
      duplicateFlightPlan: [],
    },
  },
];

const sampleTwoDuplicates = [
  {
    flightPlanInfoRegistrationResult: {
      flightPlanId: "AAAAAAAAAAAAAAAAAAA.FP20221205042709013.001",
      flightPlanRegistrationResult: "登録完了",
      flightPlanRegistrationDatetime: "2021/12/13 12:05",
      existOtherFlightRoutesCount: 2,
      duplicateFlightPlan: [
        {
          flightPlanId: "BBBBBBBBBBBBBBBBBBB.FP20221204000000000.001",
          contactEmail: "test@test.jp",
          startTime: "20221013 1330",
          finishTime: "20221013 1530",
          flyRoute: {
            type: "Polygon",
            coordinates: [
              [139.451951981, 35.6544369],
              [139.451780319, 35.65297231],
              [139.449548721, 35.65485535],
              [139.451951981, 35.6544369],
            ],
          },
        },
        {
          flightPlanId: "BBBBBBBBBBBBBBBBBBB.FP20221203000000000.001",
          contactEmail: "test2@test.jp",
          startTime: "20221013 1230",
          finishTime: "20221013 1630",
          flyRoute: { type: "Circle", center: [139.451951981, 35.6544369], radius: 10 },
        },
      ],
    },
  },
];

const sampleElevenDuplicates = [
  {
    flightPlanInfoRegistrationResult: {
      flightPlanId: "AAAAAAAAAAAAAAAAAAA.FP20221205042709013.001",
      flightPlanRegistrationResult: "登録完了",
      flightPlanRegistrationDatetime: "2021/12/13 12:05",
      existOtherFlightRoutesCount: 11,
      // ガイドラインのサンプル自体が件数11・配列0件という不一致を持つ (§0-2)
      duplicateFlightPlan: [],
    },
  },
];

describe("normalizeFlightPlanNotificationResult", () => {
  // ─── 正常系: ガイドライン4版すべて ────────────────────────────────────────────

  it("test_extracts_flight_plan_id_from_no_duplicate_info_sample", () => {
    const result = normalizeFlightPlanNotificationResult(sampleNoDuplicateInfo);
    expect(result.flightPlanId).toBe("AAAAAAAAAAAAAAAAAAA.FP20221205042709013.001");
  });

  it("test_extracts_flight_plan_id_from_zero_duplicates_sample", () => {
    const result = normalizeFlightPlanNotificationResult(sampleZeroDuplicates);
    expect(result.flightPlanId).toBe("AAAAAAAAAAAAAAAAAAA.FP20221205042709013.001");
  });

  it("test_extracts_flight_plan_id_from_two_duplicates_sample", () => {
    const result = normalizeFlightPlanNotificationResult(sampleTwoDuplicates);
    expect(result.flightPlanId).toBe("AAAAAAAAAAAAAAAAAAA.FP20221205042709013.001");
  });

  it("test_extracts_flight_plan_id_from_eleven_duplicates_sample", () => {
    const result = normalizeFlightPlanNotificationResult(sampleElevenDuplicates);
    expect(result.flightPlanId).toBe("AAAAAAAAAAAAAAAAAAA.FP20221205042709013.001");
  });

  // ─── existOtherFlightRoutesCount: 配列長から数え直さない ──────────────────────

  it("test_reads_exist_other_flight_routes_count_as_zero_when_no_duplicate_info", () => {
    const result = normalizeFlightPlanNotificationResult(sampleNoDuplicateInfo);
    expect(result.existOtherFlightRoutesCount).toBe(0);
  });

  it("test_reads_exist_other_flight_routes_count_as_two", () => {
    const result = normalizeFlightPlanNotificationResult(sampleTwoDuplicates);
    expect(result.existOtherFlightRoutesCount).toBe(2);
  });

  it("test_reads_exist_other_flight_routes_count_as_eleven_even_though_duplicate_array_is_empty", () => {
    // 件数11・配列0件のガイドライン不一致サンプル。配列長 (0) ではなく
    // existOtherFlightRoutesCount (11) を採用することを確認する
    const result = normalizeFlightPlanNotificationResult(sampleElevenDuplicates);
    expect(result.existOtherFlightRoutesCount).toBe(11);
  });

  // ─── PII 遮断: duplicateFlightPlan (contactEmail) が結果に含まれない ──────────

  it("test_result_does_not_contain_duplicate_flight_plan_key", () => {
    const result = normalizeFlightPlanNotificationResult(sampleTwoDuplicates);
    expect(result).not.toHaveProperty("duplicateFlightPlan");
  });

  it("test_result_does_not_leak_other_operators_contact_email", () => {
    const result = normalizeFlightPlanNotificationResult(sampleTwoDuplicates);
    expect(JSON.stringify(result)).not.toContain("test@test.jp");
    expect(JSON.stringify(result)).not.toContain("test2@test.jp");
  });

  // ─── 付随項目のみ欠落 → 成功する (非対称設計の証明) ────────────────────────────

  it("test_succeeds_when_registration_result_and_datetime_and_count_are_all_missing", () => {
    const minimal = [{ flightPlanInfoRegistrationResult: { flightPlanId: "FP-MIN" } }];
    const result = normalizeFlightPlanNotificationResult(minimal);
    expect(result).toEqual({
      flightPlanId: "FP-MIN",
      flightPlanRegistrationResult: null,
      flightPlanRegistrationDatetime: null,
      existOtherFlightRoutesCount: null,
    });
  });

  // ─── 異常系: すべて「取り出せない」と判定される (受理済み扱いの専用エラー) ────

  const expectUnreadable = (raw: unknown) => {
    expect(() => normalizeFlightPlanNotificationResult(raw)).toThrow(
      DipsAcceptedButUnreadableResultError
    );
  };

  it("test_throws_when_response_is_an_empty_array", () => {
    expectUnreadable([]);
  });

  it("test_throws_when_response_is_not_an_array_but_an_object", () => {
    expectUnreadable({ flightPlanInfoRegistrationResult: { flightPlanId: "FP-1" } });
  });

  it("test_throws_when_response_is_null", () => {
    expectUnreadable(null);
  });

  it("test_throws_when_response_is_a_string", () => {
    expectUnreadable("not-an-array");
  });

  it("test_throws_when_response_is_a_number", () => {
    expectUnreadable(12345);
  });

  it("test_throws_when_flight_plan_info_registration_result_key_is_missing", () => {
    expectUnreadable([{}]);
  });

  it("test_throws_when_flight_plan_info_registration_result_is_null", () => {
    expectUnreadable([{ flightPlanInfoRegistrationResult: null }]);
  });

  it("test_throws_when_flight_plan_id_is_undefined", () => {
    expectUnreadable([{ flightPlanInfoRegistrationResult: {} }]);
  });

  it("test_throws_when_flight_plan_id_is_null", () => {
    expectUnreadable([{ flightPlanInfoRegistrationResult: { flightPlanId: null } }]);
  });

  it("test_throws_when_flight_plan_id_is_empty_string", () => {
    expectUnreadable([{ flightPlanInfoRegistrationResult: { flightPlanId: "" } }]);
  });

  it("test_throws_when_flight_plan_id_is_whitespace_only", () => {
    expectUnreadable([{ flightPlanInfoRegistrationResult: { flightPlanId: "   " } }]);
  });

  it("test_throws_when_flight_plan_id_is_full_width_space_only", () => {
    // req-013 差し戻し J1 の教訓: 全角空白 (U+3000) も欠落として扱う
    expectUnreadable([{ flightPlanInfoRegistrationResult: { flightPlanId: "　　" } }]);
  });

  it("test_throws_when_flight_plan_id_is_a_number", () => {
    expectUnreadable([{ flightPlanInfoRegistrationResult: { flightPlanId: 12345 } }]);
  });

  it("test_throws_when_flight_plan_id_is_an_object", () => {
    expectUnreadable([{ flightPlanInfoRegistrationResult: { flightPlanId: {} } }]);
  });

  it("test_throws_when_flight_plan_id_is_an_array", () => {
    expectUnreadable([{ flightPlanInfoRegistrationResult: { flightPlanId: [] } }]);
  });

  it("test_throws_when_flight_plan_id_is_a_boolean", () => {
    expectUnreadable([{ flightPlanInfoRegistrationResult: { flightPlanId: true } }]);
  });

  it("test_throws_when_exist_other_flight_routes_count_is_nan", () => {
    // JSON.parse は NaN を生成できないが、呼び出し元が直接オブジェクトを渡すケースに
    // 備えて欠落扱いにする (Number.isNaN も欠落扱いにする受け入れ条件)
    expectUnreadable([
      {
        flightPlanInfoRegistrationResult: {
          flightPlanId: "FP-1",
          existOtherFlightRoutesCount: NaN,
        },
      },
    ]);
  });

  it("test_second_and_later_array_entries_are_ignored_and_do_not_prevent_success", () => {
    // ガイドラインのサンプルは常に1要素。2件以上でも HTTP 200 = 受理済みのため、
    // 失敗扱いにせず先頭を採用する
    const twoEntries = [
      ...sampleNoDuplicateInfo,
      { flightPlanInfoRegistrationResult: { flightPlanId: "FP-second" } },
    ];
    const result = normalizeFlightPlanNotificationResult(twoEntries);
    expect(result.flightPlanId).toBe("AAAAAAAAAAAAAAAAAAA.FP20221205042709013.001");
  });
});
