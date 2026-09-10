import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  DipsNotifyForm,
  INITIAL_FORM,
  validateAndBuildInput,
  type FormState,
} from "@/components/flight/plans/DipsNotifyForm";

const validForm: FormState = {
  ...INITIAL_FORM,
  flightPurpose: [1],
  flightAirspace: "1",
  assistantsNumber: "1",
  departurePoint: "東京都千代田区",
  destinationPoint: "東京都港区",
  flightSpeed: "10",
  flightAltitude: "50",
  centerLongitude: "139.7",
  centerLatitude: "35.6",
  radiusMeters: "100",
  prefecture: "13",
  municipality: "千代田区1-1",
  telephone: "09011112222",
};

describe("DipsNotifyForm — 表示", () => {
  it("test_defaults_all_new_safety_measure_flags_to_unchecked", () => {
    render(<DipsNotifyForm form={INITIAL_FORM} onFormChange={vi.fn()} />);

    expect(screen.getByLabelText("立入管理措置(レベル3飛行)を講じる")).not.toBeChecked();
    expect(screen.getByLabelText("立入管理措置(レベル3.5飛行関連)を講じる")).not.toBeChecked();
    expect(screen.getByLabelText("立入禁止措置を講じる")).not.toBeChecked();
    expect(screen.getByLabelText("係留飛行を行う")).not.toBeChecked();
  });

  it("test_defaults_the_flight_airspace_to_no_selection", () => {
    // req-013 差し戻し J2: 既定で「DID上空」等を主張してはならない
    expect(INITIAL_FORM.flightAirspace).toBe("");

    render(<DipsNotifyForm form={INITIAL_FORM} onFormChange={vi.fn()} />);

    expect(screen.getByLabelText("人・家屋の密集地域 (DID) の上空を飛行する")).not.toBeChecked();
    expect(screen.getByLabelText("地表・水面から150m以上の高さを飛行する")).not.toBeChecked();
    expect(screen.getByLabelText("空港周辺を飛行する")).not.toBeChecked();
  });

  it("test_shows_a_notice_that_airspace_selections_cannot_be_reported_here", () => {
    render(<DipsNotifyForm form={INITIAL_FORM} onFormChange={vi.fn()} />);

    expect(screen.getByText(/許可・承認が必要な特定飛行です/)).toBeInTheDocument();
  });

  it("test_hides_the_other_business_reason_field_when_purpose_13_is_not_selected", () => {
    render(<DipsNotifyForm form={INITIAL_FORM} onFormChange={vi.fn()} />);

    expect(screen.queryByText("その他1(業務)の理由")).not.toBeInTheDocument();
  });

  it("test_shows_the_other_business_reason_field_when_purpose_13_is_selected", () => {
    render(
      <DipsNotifyForm form={{ ...INITIAL_FORM, flightPurpose: [13] }} onFormChange={vi.fn()} />
    );

    expect(screen.getByText("その他1(業務)の理由")).toBeInTheDocument();
  });

  it("test_shows_the_other_non_business_reason_field_when_purpose_16_is_selected", () => {
    render(
      <DipsNotifyForm form={{ ...INITIAL_FORM, flightPurpose: [16] }} onFormChange={vi.fn()} />
    );

    expect(screen.getByText("その他2(業務以外)の理由")).toBeInTheDocument();
  });

  it("test_shows_the_prefecture_select_with_47_options_plus_the_placeholder", () => {
    render(<DipsNotifyForm form={INITIAL_FORM} onFormChange={vi.fn()} />);

    const select = screen.getByLabelText("都道府県") as HTMLSelectElement;
    expect(select.options).toHaveLength(48);
  });

  it("test_shows_a_notice_that_the_permit_application_info_is_not_sent", () => {
    render(<DipsNotifyForm form={INITIAL_FORM} onFormChange={vi.fn()} />);

    expect(
      screen.getByText("許可・承認を要する飛行はこの画面から通報できません。")
    ).toBeInTheDocument();
  });

  it("test_shows_a_notice_that_reporter_and_pilot_are_the_same_person", () => {
    render(<DipsNotifyForm form={INITIAL_FORM} onFormChange={vi.fn()} />);

    expect(screen.getByText(/通報者と操縦者は同一人物として送信します/)).toBeInTheDocument();
  });
});

describe("DipsNotifyForm — 入力の反映", () => {
  it("test_calls_onFormChange_when_the_prefecture_select_changes", async () => {
    const user = userEvent.setup();
    const onFormChange = vi.fn();
    render(<DipsNotifyForm form={INITIAL_FORM} onFormChange={onFormChange} />);

    await user.selectOptions(screen.getByLabelText("都道府県"), "13");

    const updated = onFormChange.mock.calls.at(-1)?.[0](INITIAL_FORM);
    expect(updated.prefecture).toBe("13");
  });

  it("test_calls_onFormChange_when_a_safety_measure_checkbox_is_toggled", async () => {
    const user = userEvent.setup();
    const onFormChange = vi.fn();
    render(<DipsNotifyForm form={INITIAL_FORM} onFormChange={onFormChange} />);

    await user.click(screen.getByLabelText("係留飛行を行う"));

    const updated = onFormChange.mock.calls.at(-1)?.[0](INITIAL_FORM);
    expect(updated.exceptionalConditionsMooring).toBe(true);
  });

  it("test_calls_onFormChange_when_an_airspace_checkbox_is_checked", async () => {
    const user = userEvent.setup();
    const onFormChange = vi.fn();
    render(<DipsNotifyForm form={INITIAL_FORM} onFormChange={onFormChange} />);

    await user.click(screen.getByLabelText("空港周辺を飛行する"));

    const updated = onFormChange.mock.calls.at(-1)?.[0](INITIAL_FORM);
    expect(updated.flightAirspace).toBe("3");
  });

  it("test_calls_onFormChange_when_an_airspace_checkbox_is_unchecked", async () => {
    const user = userEvent.setup();
    const onFormChange = vi.fn();
    render(
      <DipsNotifyForm
        form={{ ...INITIAL_FORM, flightAirspace: "1,3" }}
        onFormChange={onFormChange}
      />
    );

    await user.click(screen.getByLabelText("人・家屋の密集地域 (DID) の上空を飛行する"));

    const updated = onFormChange.mock.calls.at(-1)?.[0]({ ...INITIAL_FORM, flightAirspace: "1,3" });
    expect(updated.flightAirspace).toBe("3");
  });
});

describe("validateAndBuildInput — 必須項目", () => {
  it("test_requires_the_prefecture_before_submitting", () => {
    const result = validateAndBuildInput({ ...validForm, prefecture: "" });

    expect(result.ok).toBe(false);
  });

  it("test_requires_the_municipality_before_submitting", () => {
    const result = validateAndBuildInput({ ...validForm, municipality: "" });

    expect(result.ok).toBe(false);
  });

  it("test_requires_the_telephone_before_submitting", () => {
    const result = validateAndBuildInput({ ...validForm, telephone: "" });

    expect(result.ok).toBe(false);
  });

  it("test_accepts_a_fully_filled_form", () => {
    const result = validateAndBuildInput(validForm);

    expect(result.ok).toBe(true);
  });

  it("test_accepts_an_empty_flight_airspace_selection", () => {
    // req-013 差し戻し J2: No.7 は任意。特定飛行に該当しない通常の飛行は
    // 「いずれも選択しない」(空配列) が正しい値であり、必須にしてはならない
    const result = validateAndBuildInput({ ...validForm, flightAirspace: "" });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.input.flightAirspace).toEqual([]);
    }
  });

  it("test_rejects_purpose_13_without_a_reason", () => {
    const result = validateAndBuildInput({
      ...validForm,
      flightPurpose: [13],
      othergyomutext: "",
    });

    expect(result.ok).toBe(false);
  });

  it("test_includes_the_reason_in_the_built_input_when_purpose_13_is_selected", () => {
    const result = validateAndBuildInput({
      ...validForm,
      flightPurpose: [13],
      othergyomutext: "業務のため",
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.input.othergyomutext).toBe("業務のため");
    }
  });

  it("test_includes_the_new_safety_measure_flags_in_the_built_input", () => {
    const result = validateAndBuildInput({
      ...validForm,
      riskMitigationOnsiteControlL3: true,
      exceptionalConditionsMooring: true,
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.input.riskMitigationOnsiteControlL3).toBe(true);
      expect(result.input.exceptionalConditionsMooring).toBe(true);
    }
  });
});
