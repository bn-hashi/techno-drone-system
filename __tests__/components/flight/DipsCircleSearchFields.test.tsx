import { useState } from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  parseNumber,
  validateCircleSearchInput,
  DipsCircleSearchFields,
  DEFAULT_LONGITUDE,
  DEFAULT_LATITUDE,
  DEFAULT_RADIUS_METERS,
  type CircleSearchFormState,
} from "@/components/flight/DipsCircleSearchFields";

/** 実際の入力欄の挙動 (制御コンポーネント) を検証するための、状態を持つラッパー */
function ControlledWrapper({ onChange }: { onChange: (form: CircleSearchFormState) => void }) {
  const [form, setForm] = useState<CircleSearchFormState>({
    longitude: "1",
    latitude: "2",
    radiusMeters: "3",
  });
  return (
    <DipsCircleSearchFields
      form={form}
      onChange={(next) => {
        setForm(next);
        onChange(next);
      }}
    />
  );
}

describe("parseNumber", () => {
  it("test_parses_a_valid_numeric_string", () => {
    expect(parseNumber("139.7671")).toBe(139.7671);
  });

  it("test_returns_null_for_empty_string", () => {
    expect(parseNumber("  ")).toBeNull();
  });

  it("test_returns_null_for_non_numeric_string", () => {
    expect(parseNumber("abc")).toBeNull();
  });
});

describe("validateCircleSearchInput", () => {
  const validForm = {
    longitude: DEFAULT_LONGITUDE,
    latitude: DEFAULT_LATITUDE,
    radiusMeters: DEFAULT_RADIUS_METERS,
  };

  it("test_accepts_the_default_form_values", () => {
    const result = validateCircleSearchInput(validForm);

    expect(result).toEqual({ longitude: 139.7671, latitude: 35.6812, radiusMeters: 1000 });
  });

  // I9 回帰テスト (2026-09-06 レビュー): 文言は「半径 (1以上)」だが判定は
  // `radiusMeters <= 0` になっていたため、0.5 のような1未満の小数がそのまま通っていた
  it("test_rejects_a_radius_below_one_even_though_it_is_greater_than_zero", () => {
    const result = validateCircleSearchInput({ ...validForm, radiusMeters: "0.5" });

    expect(result).toEqual({ error: expect.stringContaining("半径は1以上") });
  });

  it("test_accepts_a_radius_of_exactly_one", () => {
    const result = validateCircleSearchInput({ ...validForm, radiusMeters: "1" });

    expect("error" in result).toBe(false);
  });

  it("test_rejects_a_zero_radius", () => {
    const result = validateCircleSearchInput({ ...validForm, radiusMeters: "0" });

    expect(result).toEqual({ error: expect.stringContaining("半径は1以上") });
  });

  it("test_rejects_longitude_outside_the_valid_range", () => {
    const result = validateCircleSearchInput({ ...validForm, longitude: "999" });

    expect(result).toEqual({ error: expect.stringContaining("経度は") });
  });

  it("test_rejects_latitude_outside_the_valid_range", () => {
    const result = validateCircleSearchInput({ ...validForm, latitude: "999" });

    expect(result).toEqual({ error: expect.stringContaining("緯度は") });
  });

  it("test_rejects_non_numeric_longitude", () => {
    const result = validateCircleSearchInput({ ...validForm, longitude: "abc" });

    expect("error" in result).toBe(true);
  });
});

describe("DipsCircleSearchFields", () => {
  it("test_calls_onChange_with_updated_longitude", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<ControlledWrapper onChange={onChange} />);

    await user.clear(screen.getByLabelText("経度"));
    await user.type(screen.getByLabelText("経度"), "5");

    expect(onChange).toHaveBeenLastCalledWith({ longitude: "5", latitude: "2", radiusMeters: "3" });
  });
});
