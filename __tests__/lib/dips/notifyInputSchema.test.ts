import { describe, it, expect } from "vitest";
import { DipsNotifyInputSchema } from "@/lib/dips/notifyInputSchema";
import {
  DIPS_FLIGHT_PURPOSE_OTHER_BUSINESS,
  DIPS_FLIGHT_PURPOSE_OTHER_NON_BUSINESS,
} from "@/lib/constants/dipsFlightPurpose";

const VALID_FLY_ROUTE = JSON.stringify({
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      properties: { radius: 10 },
      geometry: { type: "Circle", center: [139.7454, 35.6586] },
    },
  ],
});

const validInput = {
  flightPurpose: [15],
  flightAirspace: [1],
  assistantsNumber: 1,
  departurePoint: "泉岳寺",
  destinationPoint: "京急泉岳寺駅",
  flightSpeed: 30,
  flightAltitude: 50,
  // req-013 差し戻し J5: "{}" は geometry.type を欠くため、有効な GeoJSON 文字列に是正した
  flyRoute: VALID_FLY_ROUTE,
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

describe("DipsNotifyInputSchema — 基本項目", () => {
  it("test_accepts_a_fully_valid_input", () => {
    const result = DipsNotifyInputSchema.safeParse(validInput);

    expect(result.success).toBe(true);
  });

  it("test_rejects_an_unknown_prefecture_code", () => {
    const result = DipsNotifyInputSchema.safeParse({ ...validInput, prefecture: "99" });

    expect(result.success).toBe(false);
  });

  it("test_rejects_an_empty_municipality", () => {
    const result = DipsNotifyInputSchema.safeParse({ ...validInput, municipality: "" });

    expect(result.success).toBe(false);
  });

  it("test_rejects_an_empty_telephone", () => {
    const result = DipsNotifyInputSchema.safeParse({ ...validInput, telephone: "" });

    expect(result.success).toBe(false);
  });

  it("test_accepts_an_empty_flight_airspace_array", () => {
    // req-013 差し戻し J2: No.7 は任意。特定飛行に該当しない通常の飛行は空配列が正しい
    const result = DipsNotifyInputSchema.safeParse({ ...validInput, flightAirspace: [] });

    expect(result.success).toBe(true);
  });
});

describe("DipsNotifyInputSchema — flyRoute の中身 (req-013 差し戻し J5)", () => {
  it("test_rejects_an_empty_json_object", () => {
    // "{}" は geometry.type を欠くため、必須項目 (No.17) 不足のまま共用検証DBへ
    // 送信されてしまっていた
    const result = DipsNotifyInputSchema.safeParse({ ...validInput, flyRoute: "{}" });

    expect(result.success).toBe(false);
  });

  it("test_rejects_a_non_json_string", () => {
    const result = DipsNotifyInputSchema.safeParse({ ...validInput, flyRoute: "テスト経路" });

    expect(result.success).toBe(false);
  });

  it("test_rejects_a_feature_collection_without_a_geometry_type", () => {
    const result = DipsNotifyInputSchema.safeParse({
      ...validInput,
      flyRoute: JSON.stringify({
        type: "FeatureCollection",
        features: [{ type: "Feature", properties: {}, geometry: { center: [139.7, 35.6] } }],
      }),
    });

    expect(result.success).toBe(false);
  });

  it("test_accepts_a_valid_circle_geometry", () => {
    const result = DipsNotifyInputSchema.safeParse({ ...validInput, flyRoute: VALID_FLY_ROUTE });

    expect(result.success).toBe(true);
  });
});

describe("DipsNotifyInputSchema — その他1/その他2 の条件付き必須", () => {
  it("test_rejects_an_empty_othergyomutext_when_purpose_13_is_selected", () => {
    const result = DipsNotifyInputSchema.safeParse({
      ...validInput,
      flightPurpose: [DIPS_FLIGHT_PURPOSE_OTHER_BUSINESS],
      othergyomutext: "",
    });

    expect(result.success).toBe(false);
  });

  it("test_rejects_a_missing_othergyomutext_when_purpose_13_is_selected", () => {
    const result = DipsNotifyInputSchema.safeParse({
      ...validInput,
      flightPurpose: [DIPS_FLIGHT_PURPOSE_OTHER_BUSINESS],
    });

    expect(result.success).toBe(false);
  });

  it("test_accepts_a_payload_without_othergyomutext_when_purpose_13_is_not_selected", () => {
    const result = DipsNotifyInputSchema.safeParse(validInput);

    expect(result.success).toBe(true);
  });

  it("test_accepts_a_payload_with_othergyomutext_when_purpose_13_is_selected", () => {
    const result = DipsNotifyInputSchema.safeParse({
      ...validInput,
      flightPurpose: [DIPS_FLIGHT_PURPOSE_OTHER_BUSINESS],
      othergyomutext: "空撮以外の業務",
    });

    expect(result.success).toBe(true);
  });

  it("test_rejects_an_empty_othergyomugaitext_when_purpose_16_is_selected", () => {
    const result = DipsNotifyInputSchema.safeParse({
      ...validInput,
      flightPurpose: [DIPS_FLIGHT_PURPOSE_OTHER_NON_BUSINESS],
      othergyomugaitext: "",
    });

    expect(result.success).toBe(false);
  });

  it("test_accepts_a_payload_with_othergyomugaitext_when_purpose_16_is_selected", () => {
    const result = DipsNotifyInputSchema.safeParse({
      ...validInput,
      flightPurpose: [DIPS_FLIGHT_PURPOSE_OTHER_NON_BUSINESS],
      othergyomugaitext: "業務以外の理由",
    });

    expect(result.success).toBe(true);
  });
});
