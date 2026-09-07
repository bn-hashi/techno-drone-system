import { describe, it, expect, vi, beforeEach } from "vitest";
import { normalizeFlightPlansWithDiagnostics } from "@/lib/dips/flightPlanSchema";
import { DipsApiError } from "@/lib/dips/errors";
import { logger } from "@/lib/logger";

vi.mock("@/lib/logger", () => ({
  logger: { error: vi.fn() },
}));

beforeEach(() => {
  vi.clearAllMocks();
});

/** ガイドライン 2.3.6 レスポンスボディサンプル (正常時) に準拠した1件分 (自アカウント想定) */
const fullFlightPlanEntry = {
  flightPlanId: "AAAAAAAAAAAAAAAAAAA.FP20221125042709013.001",
  name: "ID2",
  flightPurpose: [1],
  flightAirspace: [1],
  flightType: [1],
  assistantsNumber: 5,
  departurePoint: "泉岳寺",
  startTime: "20261125 1130",
  finishTime: "20261125 1230",
  plannedMaxTime: 120,
  plannedFlightTime: 60,
  flightSpeed: 100,
  flightAltitude: 120,
  flyRoute: { type: "Circle", center: [139.4677, 35.6476], radius: 150 },
  destinationPoint: "京急泉岳寺駅",
  riskMitigationOnsiteControl: "1",
  riskMitigationOnsiteControlL3: "0",
  riskMitigationOnsiteControlL35: "0",
  riskMitigationOnsiteControl2: "0",
  exceptionalConditionsMooring: "1",
  insuranceInformation: {
    insuranceCompany: "〇×損保",
    insuranceProduct: "〇×保険",
    interPerson: -1,
    interObject: 20000000,
    insuranceAbility: "1",
  },
  // 通報者連絡先 (個人情報) はスキーマ上定義しないため意図的にテストへ含める (除去確認)
  reporter: {
    contactReporterFlag: "1",
    contactReporter: { name: "申請太郎", email: "shinsei@email.com" },
  },
  otherInformation: "その他特記事項なし",
  pilotInfo: [
    {
      pilotId: 1132709,
      contactPilotFlag: "0",
      contactPilot: { name: "操縦太郎", email: "soujuu@email.com" },
      skillCertificationNumber: "12345678901",
      firstClass: "1",
      secondClass: "1",
      privateLicense: "1",
      maker: "maker001",
      model: "model001",
    },
  ],
  aircraftInfo: [
    {
      aircraftId: 1132709,
      type: "2",
      certificationNum: "12345678901",
      symbol: "JU1234567890",
      model: "model001",
      maker: "maker001",
      certification1: "1",
      certification2: "0",
      maxWeight: 20.5,
    },
  ],
  flightPermitApplicationInfo: {
    flightPermitApplicationNumber: "dddddddddd",
    permitDate: "20221020",
    startDate: "20221020",
    finishDate: "20231020",
    contactPermitFlag: "0",
    contactPermit: { name: "操縦太郎", email: "soujuu@email.com" },
  },
};

/** 他ユーザーの飛行計画検索を想定した最小限のエントリ (○のみ) */
const minimalFlightPlanEntry = {
  flightPlanId: "OTHER-USER-PLAN-001",
  startTime: "20261125 1130",
  finishTime: "20261125 1230",
  plannedMaxTime: 120,
  plannedFlightTime: 60,
  flightSpeed: 100,
  flightAltitude: 120,
  flyRoute: { type: "Circle", center: [139.4677, 35.6476], radius: 150 },
};

describe("normalizeFlightPlansWithDiagnostics", () => {
  it("test_normalizes_full_entry_and_strips_pii_contact_fields", () => {
    const result = normalizeFlightPlansWithDiagnostics({
      flightPlanInfo: [fullFlightPlanEntry],
      totalCount: 1,
    });

    expect(result.excludedCount).toBe(0);
    const [plan] = result.flightPlans;
    expect(plan.flightPlanId).toBe("AAAAAAAAAAAAAAAAAAA.FP20221125042709013.001");
    expect(plan.name).toBe("ID2");
    expect(plan.pilotInfo).toEqual([
      {
        pilotId: 1132709,
        skillCertificationNumber: "12345678901",
        firstClass: "1",
        secondClass: "1",
        privateLicense: "1",
        maker: "maker001",
        model: "model001",
      },
    ]);
    expect(plan.flightPermitApplicationInfo).toEqual({
      flightPermitApplicationNumber: "dddddddddd",
      permitDate: "20221020",
      startDate: "20221020",
      finishDate: "20231020",
    });
    // reporter (個人情報) はそもそも型として保持しないため、正規化結果に一切現れない
    expect(plan).not.toHaveProperty("reporter");
    expect(JSON.stringify(plan)).not.toContain("申請太郎");
    expect(JSON.stringify(plan)).not.toContain("shinsei@email.com");
    expect(JSON.stringify(plan)).not.toContain("操縦太郎");
  });

  it("test_normalizes_minimal_entry_for_other_users_flight_plan_with_null_self_only_fields", () => {
    // ●項目 (自アカウントのみ出力) が省略された他ユーザーの飛行計画も、
    // ○項目のみで正しく正規化され、除外されないことを確認する
    const result = normalizeFlightPlansWithDiagnostics({
      flightPlanInfo: [minimalFlightPlanEntry],
    });

    expect(result.excludedCount).toBe(0);
    expect(result.flightPlans[0]).toMatchObject({
      flightPlanId: "OTHER-USER-PLAN-001",
      name: null,
      flightPurpose: null,
      departurePoint: null,
      pilotInfo: null,
      aircraftInfo: null,
      flightPermitApplicationInfo: null,
    });
  });

  it("test_empty_array_is_a_valid_zero_result_response", () => {
    const result = normalizeFlightPlansWithDiagnostics({ flightPlanInfo: [], totalCount: 0 });

    expect(result).toEqual({ flightPlans: [], excludedCount: 0 });
  });

  it("test_explicit_null_is_treated_as_zero_result", () => {
    const result = normalizeFlightPlansWithDiagnostics({ flightPlanInfo: null });

    expect(result).toEqual({ flightPlans: [], excludedCount: 0 });
  });

  it("test_missing_key_throws_dips_api_error", () => {
    expect(() => normalizeFlightPlansWithDiagnostics({ totalCount: 0 })).toThrow(DipsApiError);
  });

  it("test_non_array_non_null_value_throws_dips_api_error", () => {
    expect(() => normalizeFlightPlansWithDiagnostics({ flightPlanInfo: "invalid" })).toThrow(
      DipsApiError
    );
  });

  it("test_drops_only_the_entry_missing_a_required_o_field", () => {
    // flightAltitude (○: 常に必須) が欠落したエントリのみ除外され、他は残る
    const invalidEntry = { ...minimalFlightPlanEntry, flightAltitude: undefined };

    const result = normalizeFlightPlansWithDiagnostics({
      flightPlanInfo: [minimalFlightPlanEntry, invalidEntry],
    });

    expect(result.flightPlans).toHaveLength(1);
    expect(result.excludedCount).toBe(1);
  });

  it("test_all_entries_invalid_throws_dips_api_error_instead_of_returning_empty_array", () => {
    const invalidEntry = { ...minimalFlightPlanEntry, flightAltitude: undefined };

    expect(() =>
      normalizeFlightPlansWithDiagnostics({ flightPlanInfo: [invalidEntry] })
    ).toThrow(DipsApiError);
  });

  it("test_logs_dropped_entry_indices_and_issue_paths_without_the_invalid_value_itself", () => {
    const invalidEntry = { ...minimalFlightPlanEntry, flightAltitude: undefined };

    normalizeFlightPlansWithDiagnostics({
      flightPlanInfo: [minimalFlightPlanEntry, invalidEntry],
    });

    expect(logger.error).toHaveBeenCalledTimes(1);
    const [, , context] = vi.mocked(logger.error).mock.calls[0];
    const serialized = JSON.stringify(context);
    expect(serialized).toContain("flightAltitude");
  });
});
