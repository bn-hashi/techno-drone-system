// @vitest-environment node
import { describe, it, expect } from "vitest";
import { extractDisplayableDipsErrorMessage } from "@/lib/dips/dipsErrorMessage";
import { DipsApiError, DipsAuthError } from "@/lib/dips/errors";

/**
 * `extractDisplayableDipsErrorMessage` は allowlist (A) と構造判定 (B) の両方を満たした
 * ときだけ具体文言を返す (req-014 課題2)。受け入れ条件「具体文言が出るテスト」と
 * 「PII 経路では出ないテスト」を両方書く (片方だけだと「全部出す」「全部隠す」の
 * どちらかに倒れても緑になってしまうため)。
 */
describe("extractDisplayableDipsErrorMessage", () => {
  it("test_returns_the_message_when_allowlisted_and_body_is_well_formed", () => {
    // fpl realm (飛行計画通報) の本番実測エラー
    const error = new DipsApiError(
      "failed",
      400,
      '{"errorMessage":"【飛行計画通報情報更新API】日付形式が不正です。予定開始時間が2日以前です。"}',
      undefined,
      true
    );

    expect(extractDisplayableDipsErrorMessage(error)).toBe(
      "【飛行計画通報情報更新API】日付形式が不正です。予定開始時間が2日以前です。"
    );
  });

  it("test_returns_null_when_not_allowlisted_even_with_well_formed_body", () => {
    // DRS 系 (機体情報一覧取得) 等、isErrorBodySafeToDisplay が false (省略時の既定)
    const error = new DipsApiError("failed", 400, '{"errorMessage":"個人情報が含まれるかもしれない"}');

    expect(extractDisplayableDipsErrorMessage(error)).toBeNull();
  });

  it("test_returns_null_when_allowlisted_but_body_is_missing", () => {
    const error = new DipsApiError("failed", 400, undefined, undefined, true);

    expect(extractDisplayableDipsErrorMessage(error)).toBeNull();
  });

  it("test_returns_null_when_allowlisted_but_body_is_not_valid_json", () => {
    // 200/1000文字切り詰めで JSON が途中で切れたケースを含む (fail-safe)
    const error = new DipsApiError("failed", 400, '{"errorMessage":"途中で切れた', undefined, true);

    expect(extractDisplayableDipsErrorMessage(error)).toBeNull();
  });

  it("test_returns_null_when_allowlisted_but_error_message_key_is_missing", () => {
    const error = new DipsApiError("failed", 400, '{"code":"SOMETHING"}', undefined, true);

    expect(extractDisplayableDipsErrorMessage(error)).toBeNull();
  });

  it("test_returns_null_when_allowlisted_but_error_message_is_not_a_string", () => {
    const error = new DipsApiError("failed", 400, '{"errorMessage":123}', undefined, true);

    expect(extractDisplayableDipsErrorMessage(error)).toBeNull();
  });

  it("test_returns_null_when_allowlisted_but_error_message_is_whitespace_only", () => {
    const error = new DipsApiError("failed", 400, '{"errorMessage":"   "}', undefined, true);

    expect(extractDisplayableDipsErrorMessage(error)).toBeNull();
  });

  it("test_returns_null_when_allowlisted_but_body_parses_to_a_non_object", () => {
    const error = new DipsApiError("failed", 400, '"just a string"', undefined, true);

    expect(extractDisplayableDipsErrorMessage(error)).toBeNull();
  });

  it("test_returns_null_for_non_dips_api_error", () => {
    // DipsAuthError は responseBody/isErrorBodySafeToDisplay を持たない別系統のエラー
    expect(extractDisplayableDipsErrorMessage(new DipsAuthError("failed", 401))).toBeNull();
  });

  it("test_returns_null_for_a_plain_error", () => {
    expect(extractDisplayableDipsErrorMessage(new Error("boom"))).toBeNull();
  });

  it("test_trims_surrounding_whitespace_from_the_message", () => {
    const error = new DipsApiError("failed", 400, '{"errorMessage":"  拒否理由  "}', undefined, true);

    expect(extractDisplayableDipsErrorMessage(error)).toBe("拒否理由");
  });
});
