import { describe, test, expect } from "vitest";
import { calcFallDistance } from "@/lib/utils/fallDistance";

describe("calcFallDistance", () => {
  test("returns 0 when weightGrams is 0", () => {
    expect(calcFallDistance(0, 50)).toBe(0);
  });

  test("returns 0 when heightMeters is 0", () => {
    expect(calcFallDistance(500, 0)).toBe(0);
  });

  test("returns 0 when both inputs are 0", () => {
    expect(calcFallDistance(0, 0)).toBe(0);
  });

  test("returns positive distance for valid inputs", () => {
    const distance = calcFallDistance(500, 50);
    expect(distance).toBeGreaterThan(0);
  });

  test("heavier drone falls farther horizontally", () => {
    const light = calcFallDistance(250, 50);
    const heavy = calcFallDistance(2000, 50);
    expect(heavy).toBeGreaterThan(light);
  });

  test("higher altitude produces greater fall distance", () => {
    const low = calcFallDistance(500, 30);
    const high = calcFallDistance(500, 100);
    expect(high).toBeGreaterThan(low);
  });

  test("returns rounded value to 1 decimal place", () => {
    const result = calcFallDistance(500, 50);
    const rounded = Math.round(result * 10) / 10;
    expect(result).toBe(rounded);
  });
});
