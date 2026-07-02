import { describe, test, expect } from "vitest";
import { InspectionInputSchema, InspectionListSchema } from "@/lib/zod/inspectionSchema";

const validInput = {
  phase: "PRE_FLIGHT",
  itemKey: "battery",
  result: "PASS",
};

describe("InspectionInputSchema", () => {
  test("accepts a valid inspection entry without note", () => {
    const result = InspectionInputSchema.safeParse(validInput);

    expect(result.success).toBe(true);
  });

  test("accepts a valid inspection entry with note", () => {
    const result = InspectionInputSchema.safeParse({ ...validInput, note: "軽微な傷あり" });

    expect(result.success).toBe(true);
  });

  test("rejects an unknown itemKey", () => {
    const result = InspectionInputSchema.safeParse({ ...validInput, itemKey: "unknown" });

    expect(result.success).toBe(false);
  });

  test("rejects an invalid phase", () => {
    const result = InspectionInputSchema.safeParse({ ...validInput, phase: "MID_FLIGHT" });

    expect(result.success).toBe(false);
  });

  test("rejects an invalid result", () => {
    const result = InspectionInputSchema.safeParse({ ...validInput, result: "OK" });

    expect(result.success).toBe(false);
  });

  test("rejects a note longer than 500 characters", () => {
    const result = InspectionInputSchema.safeParse({ ...validInput, note: "あ".repeat(501) });

    expect(result.success).toBe(false);
  });
});

describe("InspectionListSchema", () => {
  test("accepts a list of valid entries", () => {
    const result = InspectionListSchema.safeParse([
      validInput,
      { phase: "POST_FLIGHT", itemKey: "propeller", result: "NA" },
    ]);

    expect(result.success).toBe(true);
  });

  test("rejects an empty list", () => {
    const result = InspectionListSchema.safeParse([]);

    expect(result.success).toBe(false);
  });

  test("rejects duplicate phase and itemKey combinations", () => {
    const result = InspectionListSchema.safeParse([validInput, { ...validInput, result: "FAIL" }]);

    expect(result.success).toBe(false);
  });
});
