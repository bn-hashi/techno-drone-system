import { describe, it, expect } from "vitest";
import {
  buildFlightPlanNotificationPayload,
  buildReporter,
  buildPilotInfo,
  buildAircraftInfo,
  toDipsFlag,
  gramsToKilograms,
  type BuildFlightPlanNotificationPayloadInput,
} from "@/lib/dips/notificationMapper";
import type {
  DipsFlightPlanNotificationPayload,
  DipsNotificationUserInput,
} from "@/lib/dips/types";
import { DIPS_COUNTRY_CODE_JAPAN } from "@/lib/constants/dipsAddressCode";
import {
  DIPS_FLIGHT_PURPOSE_OTHER_BUSINESS,
  DIPS_FLIGHT_PURPOSE_OTHER_NON_BUSINESS,
} from "@/lib/constants/dipsFlightPurpose";

/**
 * FPRガイドライン v1.9 §2.3.8 の必須51項目の網羅テスト。
 *
 * 出典: `docs/dips-flight-plan-required-fields.md` (No 番号・必須マークはガイドライン PDF
 * を1行ずつ精読して突合したもの。本テストの REQUIRED_FIELDS 表と対になる対応表)。
 * 元は `_orchestrator/results/req-013/builder.md` にあったが、`_orchestrator/` は
 * gitignore 対象で本番サーバーから参照できないため `docs/` 配下へ移設した
 * (2026-09-10, req-013 差し戻し J7)。
 *
 * 2026-07-07 から2か月間、送信項目が DIPS の必須要件を満たさず拒否され続けた事故の
 * 再発防止策: このテストは「51項目のうち1つでも payload から欠ければ失敗する」。
 * 項目を削る・リネームする変更は、まずこのテストの REQUIRED_FIELDS 表を
 * ガイドラインと突き合わせてから行うこと (推測で消してはならない)。
 *
 * No.18(center)/No.21(radius) はガイドラインの必須マークが △ (Circle 選択時のみ必須) の
 * ため、○ (無条件必須) の51項目には含めない (現状の実装は Circle 固定のため実質必須だが、
 * ガイドライン自身の表記に忠実にこの51項目からは除外する)。
 */
interface RequiredFieldSpec {
  no: number;
  label: string;
  get: (payload: DipsFlightPlanNotificationPayload) => unknown;
}

function parseFlyRoute(payload: DipsFlightPlanNotificationPayload): {
  features: Array<{ geometry: { type: string } }>;
} {
  return JSON.parse(payload.flightPlanInfo.flyRoute);
}

/**
 * REQUIRED_FIELDS の値が「欠落」とみなされるかを判定する。
 *
 * req-013 差し戻し J1: 元の判定は `value === undefined || value === null` のみで、
 * 空文字を欠落として検出できなかった (`buildContactPerson` の `name` を `""` に
 * 書き換えても本ファイルの30テストが全緑になることを実証済み)。DIPS が返す
 * 「必須項目不足」は空値でも発生するため、空文字 (前後空白のみを含む) と NaN も
 * 欠落として扱う。
 */
function isMissingRequiredValue(value: unknown): boolean {
  if (value === undefined || value === null) return true;
  if (typeof value === "string" && value.trim() === "") return true;
  if (typeof value === "number" && Number.isNaN(value)) return true;
  return false;
}

const REQUIRED_FIELDS: RequiredFieldSpec[] = [
  { no: 1, label: "flightPlanInfo", get: (p) => p.flightPlanInfo },
  { no: 3, label: "flightPlanInfo.name", get: (p) => p.flightPlanInfo.name },
  { no: 4, label: "flightPlanInfo.flightPurpose", get: (p) => p.flightPlanInfo.flightPurpose },
  {
    no: 9,
    label: "flightPlanInfo.assistantsNumber",
    get: (p) => p.flightPlanInfo.assistantsNumber,
  },
  { no: 10, label: "flightPlanInfo.departurePoint", get: (p) => p.flightPlanInfo.departurePoint },
  { no: 11, label: "flightPlanInfo.startTime", get: (p) => p.flightPlanInfo.startTime },
  { no: 12, label: "flightPlanInfo.plannedMaxTime", get: (p) => p.flightPlanInfo.plannedMaxTime },
  {
    no: 13,
    label: "flightPlanInfo.plannedFlightTime",
    get: (p) => p.flightPlanInfo.plannedFlightTime,
  },
  { no: 14, label: "flightPlanInfo.flightSpeed", get: (p) => p.flightPlanInfo.flightSpeed },
  { no: 15, label: "flightPlanInfo.flightAltitude", get: (p) => p.flightPlanInfo.flightAltitude },
  { no: 16, label: "flightPlanInfo.flyRoute", get: (p) => p.flightPlanInfo.flyRoute },
  {
    no: 17,
    label: "flyRoute 内の geometry.type (Circle)",
    get: (p) => parseFlyRoute(p).features[0]?.geometry.type,
  },
  {
    no: 26,
    label: "flightPlanInfo.destinationPoint",
    get: (p) => p.flightPlanInfo.destinationPoint,
  },
  {
    no: 27,
    label: "flightPlanInfo.riskMitigationOnsiteControl",
    get: (p) => p.flightPlanInfo.riskMitigationOnsiteControl,
  },
  {
    no: 28,
    label: "flightPlanInfo.riskMitigationOnsiteControlL3",
    get: (p) => p.flightPlanInfo.riskMitigationOnsiteControlL3,
  },
  {
    no: 29,
    label: "flightPlanInfo.riskMitigationOnsiteControlL35",
    get: (p) => p.flightPlanInfo.riskMitigationOnsiteControlL35,
  },
  {
    no: 30,
    label: "flightPlanInfo.riskMitigationOnsiteControl2",
    get: (p) => p.flightPlanInfo.riskMitigationOnsiteControl2,
  },
  {
    no: 31,
    label: "flightPlanInfo.exceptionalConditionsMooring",
    get: (p) => p.flightPlanInfo.exceptionalConditionsMooring,
  },
  { no: 38, label: "flightPlanInfo.reporter", get: (p) => p.flightPlanInfo.reporter },
  {
    no: 39,
    label: "reporter.contactReporterFlag",
    get: (p) => p.flightPlanInfo.reporter.contactReporterFlag,
  },
  {
    no: 40,
    label: "reporter.contactReporter",
    get: (p) => p.flightPlanInfo.reporter.contactReporter,
  },
  {
    no: 41,
    label: "reporter.contactReporter.name",
    get: (p) => p.flightPlanInfo.reporter.contactReporter.name,
  },
  {
    no: 42,
    label: "reporter.contactReporter.country",
    get: (p) => p.flightPlanInfo.reporter.contactReporter.country,
  },
  {
    no: 43,
    label: "reporter.contactReporter.prefectures",
    get: (p) => p.flightPlanInfo.reporter.contactReporter.prefectures,
  },
  {
    no: 44,
    label: "reporter.contactReporter.municipality",
    get: (p) => p.flightPlanInfo.reporter.contactReporter.municipality,
  },
  {
    no: 45,
    label: "reporter.contactReporter.telephoneCountry",
    get: (p) => p.flightPlanInfo.reporter.contactReporter.telephoneCountry,
  },
  {
    no: 46,
    label: "reporter.contactReporter.telephone",
    get: (p) => p.flightPlanInfo.reporter.contactReporter.telephone,
  },
  {
    no: 47,
    label: "reporter.contactReporter.email",
    get: (p) => p.flightPlanInfo.reporter.contactReporter.email,
  },
  { no: 49, label: "flightPlanInfo.pilotInfo", get: (p) => p.flightPlanInfo.pilotInfo },
  {
    no: 50,
    label: "pilotInfo[0].contactPilotFlag",
    get: (p) => p.flightPlanInfo.pilotInfo[0]?.contactPilotFlag,
  },
  {
    no: 51,
    label: "pilotInfo[0].contactPilot",
    get: (p) => p.flightPlanInfo.pilotInfo[0]?.contactPilot,
  },
  {
    no: 52,
    label: "pilotInfo[0].contactPilot.name",
    get: (p) => p.flightPlanInfo.pilotInfo[0]?.contactPilot.name,
  },
  {
    no: 53,
    label: "pilotInfo[0].contactPilot.country",
    get: (p) => p.flightPlanInfo.pilotInfo[0]?.contactPilot.country,
  },
  {
    no: 54,
    label: "pilotInfo[0].contactPilot.prefectures",
    get: (p) => p.flightPlanInfo.pilotInfo[0]?.contactPilot.prefectures,
  },
  {
    no: 55,
    label: "pilotInfo[0].contactPilot.municipality",
    get: (p) => p.flightPlanInfo.pilotInfo[0]?.contactPilot.municipality,
  },
  {
    no: 56,
    label: "pilotInfo[0].contactPilot.telephoneCountry",
    get: (p) => p.flightPlanInfo.pilotInfo[0]?.contactPilot.telephoneCountry,
  },
  {
    no: 57,
    label: "pilotInfo[0].contactPilot.telephone",
    get: (p) => p.flightPlanInfo.pilotInfo[0]?.contactPilot.telephone,
  },
  {
    no: 58,
    label: "pilotInfo[0].contactPilot.email",
    get: (p) => p.flightPlanInfo.pilotInfo[0]?.contactPilot.email,
  },
  {
    no: 60,
    label: "pilotInfo[0].firstClass",
    get: (p) => p.flightPlanInfo.pilotInfo[0]?.firstClass,
  },
  {
    no: 61,
    label: "pilotInfo[0].secondClass",
    get: (p) => p.flightPlanInfo.pilotInfo[0]?.secondClass,
  },
  {
    no: 62,
    label: "pilotInfo[0].privateLicense",
    get: (p) => p.flightPlanInfo.pilotInfo[0]?.privateLicense,
  },
  { no: 63, label: "pilotInfo[0].maker", get: (p) => p.flightPlanInfo.pilotInfo[0]?.maker },
  { no: 64, label: "pilotInfo[0].model", get: (p) => p.flightPlanInfo.pilotInfo[0]?.model },
  { no: 65, label: "flightPlanInfo.aircraftInfo", get: (p) => p.flightPlanInfo.aircraftInfo },
  { no: 66, label: "aircraftInfo[0].type", get: (p) => p.flightPlanInfo.aircraftInfo[0]?.type },
  { no: 68, label: "aircraftInfo[0].symbol", get: (p) => p.flightPlanInfo.aircraftInfo[0]?.symbol },
  { no: 69, label: "aircraftInfo[0].model", get: (p) => p.flightPlanInfo.aircraftInfo[0]?.model },
  { no: 70, label: "aircraftInfo[0].maker", get: (p) => p.flightPlanInfo.aircraftInfo[0]?.maker },
  {
    no: 71,
    label: "aircraftInfo[0].certification1",
    get: (p) => p.flightPlanInfo.aircraftInfo[0]?.certification1,
  },
  {
    no: 72,
    label: "aircraftInfo[0].certification2",
    get: (p) => p.flightPlanInfo.aircraftInfo[0]?.certification2,
  },
  {
    no: 73,
    label: "aircraftInfo[0].maxWeight",
    get: (p) => p.flightPlanInfo.aircraftInfo[0]?.maxWeight,
  },
];

// 依頼書・planner突合表で確定した「必須51項目」の No 番号一覧。この数と REQUIRED_FIELDS の
// 件数が一致しない場合、テーブル自体の作成ミスなので先にここで検知する。
const EXPECTED_REQUIRED_FIELD_COUNT = 51;

const validUserInput: DipsNotificationUserInput = {
  flightPurpose: [15],
  flightAirspace: [1],
  assistantsNumber: 1,
  departurePoint: "泉岳寺",
  destinationPoint: "京急泉岳寺駅",
  flightSpeed: 30,
  flightAltitude: 50,
  flyRoute: JSON.stringify({
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        properties: { radius: 10 },
        geometry: { type: "Circle", center: [139.7454, 35.6586] },
      },
    ],
  }),
  riskMitigationOnsiteControl: true,
  riskMitigationOnsiteControlL3: false,
  riskMitigationOnsiteControlL35: false,
  riskMitigationOnsiteControl2: false,
  exceptionalConditionsMooring: false,
  prefecture: "13",
  municipality: "中央区銀座1-1",
  telephone: "09011112222",
  firstClass: false,
  secondClass: false,
  privateLicense: false,
};

const validInput: BuildFlightPlanNotificationPayloadInput = {
  planTitle: "訓練飛行",
  plannedAt: new Date("2026-07-03T01:00:00Z"),
  durationMin: 60,
  // req-013 差し戻し J3: 機体の航続可能時間は所要時間 (60分) 以上でなければ矛盾する
  // (以前は 20 だったため、機体が20分しか飛べないのに60分の飛行を計画する矛盾した
  // 基準データが「valid」として固定されていた)
  aircraftMaxFlightTimeMin: 90,
  userInput: validUserInput,
  reporterUser: { name: "申請太郎", email: "shinsei@example.com" },
  aircraft: {
    dipsUaType: 2,
    registrationNumber: "JU1234567890",
    modelNumber: "model001",
    manufacturer: "maker001",
    hasDipsCertification1: false,
    hasDipsCertification2: false,
    dipsCertificationNumber: null,
    weightGrams: 900,
    maxTakeoffWeightGrams: null,
  },
};

describe("REQUIRED_FIELDS テーブル自体の整合性", () => {
  it(`test_required_fields_table_has_exactly_${EXPECTED_REQUIRED_FIELD_COUNT}_entries`, () => {
    expect(REQUIRED_FIELDS).toHaveLength(EXPECTED_REQUIRED_FIELD_COUNT);
  });

  it("test_required_fields_table_has_no_duplicated_no", () => {
    const nos = REQUIRED_FIELDS.map((field) => field.no);
    expect(new Set(nos).size).toBe(nos.length);
  });
});

describe("isMissingRequiredValue (REQUIRED_FIELDS の欠落判定)", () => {
  it("test_treats_undefined_as_missing", () => {
    expect(isMissingRequiredValue(undefined)).toBe(true);
  });

  it("test_treats_null_as_missing", () => {
    expect(isMissingRequiredValue(null)).toBe(true);
  });

  it("test_treats_an_empty_string_as_missing", () => {
    expect(isMissingRequiredValue("")).toBe(true);
  });

  it("test_treats_a_whitespace_only_string_as_missing", () => {
    expect(isMissingRequiredValue("   ")).toBe(true);
  });

  it("test_treats_nan_as_missing", () => {
    expect(isMissingRequiredValue(Number.NaN)).toBe(true);
  });

  it("test_does_not_treat_zero_as_missing", () => {
    // assistantsNumber (No.9) 等は 0 (補助者無し) が正当な値のため、falsy 判定にしてはならない
    expect(isMissingRequiredValue(0)).toBe(false);
  });

  it("test_does_not_treat_the_string_zero_as_missing", () => {
    // certification1/2 等の DIPS フラグは "0" (無し) が正当な値のため、falsy 判定にしてはならない
    expect(isMissingRequiredValue("0")).toBe(false);
  });

  it("test_does_not_treat_a_non_empty_string_as_missing", () => {
    expect(isMissingRequiredValue("申請太郎")).toBe(false);
  });

  it("test_does_not_treat_an_object_as_missing", () => {
    expect(isMissingRequiredValue({ contactReporterFlag: "1" })).toBe(false);
  });
});

describe("buildFlightPlanNotificationPayload — 必須51項目の網羅 (最重要)", () => {
  it("test_builds_a_payload_that_contains_all_51_required_fields", () => {
    const payload = buildFlightPlanNotificationPayload(validInput);

    const missing = REQUIRED_FIELDS.filter((field) =>
      isMissingRequiredValue(field.get(payload))
    ).map((field) => `No.${field.no} ${field.label}`);

    expect(missing).toEqual([]);
  });
});

describe("buildFlightPlanNotificationPayload — 飛行時間の整合 (req-013 差し戻し J3)", () => {
  it("test_throws_when_the_duration_exceeds_the_aircraft_max_flight_time", () => {
    // 機体の航続可能時間 (20分) より長い所要時間 (60分) を計画する、物理的に矛盾した入力。
    // 以前はこの矛盾を検出せず、そのまま DIPS へ送信していた
    expect(() =>
      buildFlightPlanNotificationPayload({
        ...validInput,
        durationMin: 60,
        aircraftMaxFlightTimeMin: 20,
      })
    ).toThrow(/航続可能時間/);
  });

  it("test_does_not_throw_when_the_duration_equals_the_aircraft_max_flight_time", () => {
    // 境界値: 所要時間 == 航続可能時間 は矛盾ではない (ちょうど使い切る飛行)
    expect(() =>
      buildFlightPlanNotificationPayload({
        ...validInput,
        durationMin: 20,
        aircraftMaxFlightTimeMin: 20,
      })
    ).not.toThrow();
  });

  it("test_does_not_throw_when_the_duration_is_within_the_aircraft_max_flight_time", () => {
    expect(() => buildFlightPlanNotificationPayload(validInput)).not.toThrow();
  });
});

describe("buildFlightPlanNotificationPayload — 個別の業務ルール", () => {
  it("test_sets_exactly_one_contact_flag_to_one", () => {
    // ガイドライン備考: 通報者・操縦者・許可承認のいずれか一つの連絡先フラグが"1"であること。
    // 許可承認情報は送らないため、通報者側の flag だけが"1"であることを確認する
    const payload = buildFlightPlanNotificationPayload(validInput);

    expect(payload.flightPlanInfo.reporter.contactReporterFlag).toBe("1");
    expect(payload.flightPlanInfo.pilotInfo[0].contactPilotFlag).toBe("0");
  });

  it("test_omits_the_duplicate_flight_plan_flag", () => {
    // req-013 差し戻し J4: ガイドラインのサンプルでは getDuplicateFlightPlanFlag は
    // flightPlanInfo の兄弟 (ペイロードのトップレベル)。flightPlanInfo 直下ではなく
    // payload 自体を検査しないと、誤った階層に追加されてもガードが発火しない
    // (20260908-fpr-guideline-2.3.8-samples.txt のサンプル JSON で階層を確認済み)
    const payload = buildFlightPlanNotificationPayload(validInput);

    expect(payload).not.toHaveProperty("getDuplicateFlightPlanFlag");
  });

  it("test_omits_the_permit_application_info", () => {
    // req-013 差し戻し J4: flightPermitApplicationInfo も同様にトップレベル
    // (ガイドラインのサンプル JSON で flightPlanInfo の閉じ括弧の後に出現することを確認済み)
    const payload = buildFlightPlanNotificationPayload(validInput);

    expect(payload).not.toHaveProperty("flightPermitApplicationInfo");
  });

  it("test_omits_the_insurance_information", () => {
    const payload = buildFlightPlanNotificationPayload(validInput);

    expect(payload.flightPlanInfo).not.toHaveProperty("insuranceInformation");
  });

  it("test_includes_othergyomutext_only_when_purpose_13_is_selected", () => {
    const payload = buildFlightPlanNotificationPayload({
      ...validInput,
      userInput: {
        ...validUserInput,
        flightPurpose: [DIPS_FLIGHT_PURPOSE_OTHER_BUSINESS],
        othergyomutext: "空撮以外の業務",
      },
    });

    expect(payload.flightPlanInfo.othergyomutext).toBe("空撮以外の業務");
  });

  it("test_omits_othergyomutext_when_purpose_13_is_not_selected", () => {
    const payload = buildFlightPlanNotificationPayload(validInput);

    expect(payload.flightPlanInfo).not.toHaveProperty("othergyomutext");
  });

  it("test_includes_othergyomugaitext_only_when_purpose_16_is_selected", () => {
    const payload = buildFlightPlanNotificationPayload({
      ...validInput,
      userInput: {
        ...validUserInput,
        flightPurpose: [DIPS_FLIGHT_PURPOSE_OTHER_NON_BUSINESS],
        othergyomugaitext: "業務以外の理由",
      },
    });

    expect(payload.flightPlanInfo.othergyomugaitext).toBe("業務以外の理由");
  });

  it("test_omits_othergyomugaitext_when_purpose_16_is_not_selected", () => {
    const payload = buildFlightPlanNotificationPayload(validInput);

    expect(payload.flightPlanInfo).not.toHaveProperty("othergyomugaitext");
  });

  it("test_converts_the_aircraft_weight_from_grams_to_kilograms", () => {
    const payload = buildFlightPlanNotificationPayload(validInput);

    expect(payload.flightPlanInfo.aircraftInfo[0].maxWeight).toBe(0.9);
  });

  it("test_prefers_the_max_takeoff_weight_over_the_airframe_weight", () => {
    const payload = buildFlightPlanNotificationPayload({
      ...validInput,
      aircraft: { ...validInput.aircraft, maxTakeoffWeightGrams: 1200 },
    });

    expect(payload.flightPlanInfo.aircraftInfo[0].maxWeight).toBe(1.2);
  });

  it("test_sends_zero_for_an_aircraft_without_certification", () => {
    // req-013 人の決定: 全機体が未取得だが、ハードコードせずマスタの値 (false) を読む
    const payload = buildFlightPlanNotificationPayload(validInput);

    expect(payload.flightPlanInfo.aircraftInfo[0].certification1).toBe("0");
    expect(payload.flightPlanInfo.aircraftInfo[0].certification2).toBe("0");
  });

  it("test_sends_one_for_an_aircraft_with_certification", () => {
    // ハードコードしていないことの確認: マスタの値が true なら "1" を送る
    const payload = buildFlightPlanNotificationPayload({
      ...validInput,
      aircraft: {
        ...validInput.aircraft,
        hasDipsCertification1: true,
        hasDipsCertification2: true,
      },
    });

    expect(payload.flightPlanInfo.aircraftInfo[0].certification1).toBe("1");
    expect(payload.flightPlanInfo.aircraftInfo[0].certification2).toBe("1");
  });

  it("test_omits_certification_num_when_not_set", () => {
    const payload = buildFlightPlanNotificationPayload(validInput);

    expect(payload.flightPlanInfo.aircraftInfo[0]).not.toHaveProperty("certificationNum");
  });

  it("test_includes_certification_num_when_set", () => {
    const payload = buildFlightPlanNotificationPayload({
      ...validInput,
      aircraft: { ...validInput.aircraft, dipsCertificationNumber: "12345678901" },
    });

    expect(payload.flightPlanInfo.aircraftInfo[0].certificationNum).toBe("12345678901");
  });

  it("test_uses_the_japan_country_code_for_the_reporter", () => {
    const payload = buildFlightPlanNotificationPayload(validInput);

    expect(payload.flightPlanInfo.reporter.contactReporter.country).toBe(DIPS_COUNTRY_CODE_JAPAN);
    expect(payload.flightPlanInfo.reporter.contactReporter.telephoneCountry).toBe(
      DIPS_COUNTRY_CODE_JAPAN
    );
  });

  it("test_uses_the_same_person_for_reporter_and_pilot", () => {
    // req-013 人の決定: 操縦者と通報者は同一人物として扱う
    const payload = buildFlightPlanNotificationPayload(validInput);

    expect(payload.flightPlanInfo.pilotInfo[0].contactPilot.name).toBe(
      payload.flightPlanInfo.reporter.contactReporter.name
    );
    expect(payload.flightPlanInfo.pilotInfo[0].contactPilot.email).toBe(
      payload.flightPlanInfo.reporter.contactReporter.email
    );
  });

  it("test_uses_the_representative_aircraft_maker_and_model_for_the_pilot", () => {
    const payload = buildFlightPlanNotificationPayload(validInput);

    expect(payload.flightPlanInfo.pilotInfo[0].maker).toBe("maker001");
    expect(payload.flightPlanInfo.pilotInfo[0].model).toBe("model001");
  });

  it("test_truncates_the_flight_plan_name_to_30_characters", () => {
    const payload = buildFlightPlanNotificationPayload({
      ...validInput,
      planTitle: "あ".repeat(40),
    });

    expect(payload.flightPlanInfo.name).toHaveLength(30);
  });
});

describe("toDipsFlag", () => {
  it("test_returns_1_for_true", () => {
    expect(toDipsFlag(true)).toBe("1");
  });

  it("test_returns_0_for_false", () => {
    expect(toDipsFlag(false)).toBe("0");
  });
});

describe("gramsToKilograms", () => {
  it("test_converts_grams_to_kilograms", () => {
    expect(gramsToKilograms(900)).toBe(0.9);
  });

  it("test_converts_a_gram_value_that_does_not_divide_evenly", () => {
    expect(gramsToKilograms(20500)).toBe(20.5);
  });
});

describe("buildReporter", () => {
  it("test_fixes_the_contact_reporter_flag_to_1", () => {
    const reporter = buildReporter({
      name: "申請太郎",
      email: "shinsei@example.com",
      prefecture: "13",
      municipality: "中央区銀座1-1",
      telephone: "09011112222",
    });

    expect(reporter.contactReporterFlag).toBe("1");
  });
});

describe("buildPilotInfo", () => {
  it("test_fixes_the_contact_pilot_flag_to_0", () => {
    const pilotInfo = buildPilotInfo(
      {
        name: "申請太郎",
        email: "shinsei@example.com",
        prefecture: "13",
        municipality: "銀座",
        telephone: "090",
      },
      { firstClass: false, secondClass: false, privateLicense: false },
      { maker: "maker001", model: "model001" }
    );

    expect(pilotInfo[0].contactPilotFlag).toBe("0");
  });

  it("test_returns_exactly_one_pilot_entry", () => {
    // req-013 人の決定: 複数操縦者運用の作り込みはしない (YAGNI)。常に1件
    const pilotInfo = buildPilotInfo(
      {
        name: "申請太郎",
        email: "shinsei@example.com",
        prefecture: "13",
        municipality: "銀座",
        telephone: "090",
      },
      { firstClass: true, secondClass: true, privateLicense: true },
      { maker: "maker001", model: "model001" }
    );

    expect(pilotInfo).toHaveLength(1);
  });
});

describe("buildAircraftInfo", () => {
  it("test_returns_exactly_one_aircraft_entry", () => {
    const aircraftInfo = buildAircraftInfo(validInput.aircraft);

    expect(aircraftInfo).toHaveLength(1);
  });

  it("test_stringifies_the_dips_ua_type", () => {
    const aircraftInfo = buildAircraftInfo({ ...validInput.aircraft, dipsUaType: 3 });

    expect(aircraftInfo[0].type).toBe("3");
  });
});
