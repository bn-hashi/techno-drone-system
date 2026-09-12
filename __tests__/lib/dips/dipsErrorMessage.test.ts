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

  // ─── 2026-09-12 CodeRabbit指摘1: 長い有効な JSON でも errorMessage を読める ─────

  it("test_returns_the_message_when_the_raw_body_exceeds_1000_chars_but_is_valid_json", () => {
    // 立入管理措置等の必須項目不足を複数羅列した長文エラーを模す (本文自体は1000文字超)。
    // DipsApiClient.request() が本文を構造解析できる状態のまま保持するようになった
    // (2026-09-12 修正) ことの検証。修正前はここが1000文字で切り詰められており
    // JSON.parse に失敗して null になっていた
    const longErrorMessage = "必須項目が不足しています: " + "立入管理措置は必須項目です。".repeat(80);
    expect(longErrorMessage.length).toBeGreaterThan(1000);
    const rawBody = JSON.stringify({ errorMessage: longErrorMessage });
    expect(rawBody.length).toBeGreaterThan(1000);

    const error = new DipsApiError("failed", 400, rawBody, undefined, true);

    const result = extractDisplayableDipsErrorMessage(error);
    expect(result).not.toBeNull();
    expect(result).toBe(longErrorMessage.slice(0, 1000));
    expect(result?.length).toBe(1000);
  });

  it("test_truncates_the_extracted_message_to_1000_chars_even_when_the_json_value_is_longer", () => {
    const veryLongMessage = "あ".repeat(2000);
    const rawBody = JSON.stringify({ errorMessage: veryLongMessage });

    const error = new DipsApiError("failed", 400, rawBody, undefined, true);

    const result = extractDisplayableDipsErrorMessage(error);
    expect(result).toHaveLength(1000);
    expect(result).toBe(veryLongMessage.slice(0, 1000));
  });

  it("test_returns_null_for_non_allowlisted_endpoints_regardless_of_message_length_pii_regression_guard", () => {
    // PII 制限の回帰防止: allowlist 対象外 (DRS/req 系) では本文が長くても
    // (200文字切り詰め由来の非JSONも含め) 具体文言を絶対に返さない
    const longErrorMessage = "個人情報が含まれるかもしれない住所氏名電話番号".repeat(20);
    const rawBody = JSON.stringify({ errorMessage: longErrorMessage }).slice(0, 200);

    const error = new DipsApiError("failed", 400, rawBody, undefined, false);

    expect(extractDisplayableDipsErrorMessage(error)).toBeNull();
  });
});
