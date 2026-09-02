import { describe, it, expect } from "vitest";
import {
  buildPermissionApplicationTestPayload,
  normalizePermissionApplicationResult,
} from "@/lib/dips/permissionApplicationSchema";
import { DipsApiError } from "@/lib/dips/errors";

describe("buildPermissionApplicationTestPayload", () => {
  it("test_fixes_flight_location_and_destination_to_tokyo_to_avoid_osaka_jurisdiction_error", () => {
    // 設定通知書シート2 D16/E16: 検証用申請者IDは住所が東京で設定されているため、
    // 大阪航空局宛はエラーになる。東京都のみ・東京航空局固定であることを直接検証する
    const payload = buildPermissionApplicationTestPayload(new Date("2026-09-02T00:00:00+09:00"));

    expect({
      flyLocation: payload.flyLocation,
      keninfo: payload.keninfo,
      destinationKbn: payload.destinationKbn,
      destinationCode: payload.destinationCode,
    }).toEqual({ flyLocation: "3", keninfo: ["13"], destinationKbn: "01", destinationCode: "ECAB" });
  });

  it("test_computes_form_start_as_tomorrow_in_jst", () => {
    const payload = buildPermissionApplicationTestPayload(new Date("2026-09-02T00:00:00+09:00"));

    expect(payload.formStart).toBe("2026/09/03");
  });

  it("test_computes_form_end_90_days_after_form_start", () => {
    const payload = buildPermissionApplicationTestPayload(new Date("2026-09-02T00:00:00+09:00"));

    // 2026/09/03 (formStart) + 90日 = 2026/12/02
    expect(payload.formEnd).toBe("2026/12/02");
  });

  it("test_includes_exactly_one_pilot_and_one_aircraft", () => {
    const payload = buildPermissionApplicationTestPayload();

    expect({ pilots: payload.pilotInfos.length, aircrafts: payload.uaInfos.length }).toEqual({
      pilots: 1,
      aircrafts: 1,
    });
  });

  it("test_uses_fixed_form_kind_and_category", () => {
    const payload = buildPermissionApplicationTestPayload();

    expect({ formKind: payload.formKind, category: payload.category }).toEqual({
      formKind: "1",
      category: "2",
    });
  });

  it("test_registration_symbol_is_12_characters_matching_guideline_sample", () => {
    // 設定通知書「検証環境での確認ポイント」: 検証環境で利用可能な登録記号は
    // 任意の英数半角12桁の文字列。ガイドラインのリクエストボディサンプルの値を使う
    const payload = buildPermissionApplicationTestPayload();

    expect(payload.uaInfos[0].regSymbol).toHaveLength(12);
  });
});

describe("normalizePermissionApplicationResult", () => {
  it("test_parses_valid_response_into_form_num", () => {
    const result = normalizePermissionApplicationResult({ formNum: "Q190100001" });

    expect(result).toEqual({ formNum: "Q190100001" });
  });

  it("test_throws_dips_api_error_when_form_num_is_missing", () => {
    expect(() => normalizePermissionApplicationResult({})).toThrow(DipsApiError);
  });

  it("test_throws_dips_api_error_when_form_num_is_not_a_string", () => {
    expect(() => normalizePermissionApplicationResult({ formNum: 12345 })).toThrow(DipsApiError);
  });

  it("test_throws_dips_api_error_when_response_is_not_an_object", () => {
    expect(() => normalizePermissionApplicationResult("not-an-object")).toThrow(DipsApiError);
  });
});
