import { describe, it, expect } from "vitest";
import { DipsNotifyInputSchema } from "@/lib/dips/notifyInputSchema";
import {
  DIPS_FLIGHT_PURPOSE_OTHER_BUSINESS,
  DIPS_FLIGHT_PURPOSE_OTHER_NON_BUSINESS,
} from "@/lib/constants/dipsFlightPurpose";

const validInput = {
  flightPurpose: [15],
  flightAirspace: [1],
  assistantsNumber: 1,
  departurePoint: "泉岳寺",
  destinationPoint: "京急泉岳寺駅",
  flightSpeed: 30,
  flightAltitude: 50,
  flyRoute: "{}",
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
