import { describe, it, expect } from "vitest";
import { isSafeInternalReturnPath } from "@/lib/dips/returnPath";

/**
 * DIPS 認可後の戻り先パスバリデータ (オープンリダイレクト対策)
 *
 * /flight/ 配下のアプリ内パスのみを許可し、外部 URL・プロトコル相対 URL・
 * パストラバーサル・クエリ/フラグメント付きパスをすべて拒否する。
 */
describe("isSafeInternalReturnPath", () => {
  describe("valid paths", () => {
    it("test_flight_plans_list_path_returns_true", () => {
      expect(isSafeInternalReturnPath("/flight/plans")).toBe(true);
    });

    it("test_flight_plan_detail_path_returns_true", () => {
      expect(isSafeInternalReturnPath("/flight/plans/cm4abc123XYZ_-")).toBe(true);
    });

    it("test_nested_flight_path_returns_true", () => {
      expect(isSafeInternalReturnPath("/flight/aircraft/abc123/edit")).toBe(true);
    });
  });

  describe("invalid paths", () => {
    it("test_empty_string_returns_false", () => {
      expect(isSafeInternalReturnPath("")).toBe(false);
    });

    it("test_null_returns_false", () => {
      expect(isSafeInternalReturnPath(null)).toBe(false);
    });

    it("test_undefined_returns_false", () => {
      expect(isSafeInternalReturnPath(undefined)).toBe(false);
    });

    it("test_root_path_returns_false", () => {
      expect(isSafeInternalReturnPath("/")).toBe(false);
    });

    it("test_flight_without_trailing_segment_returns_false", () => {
      expect(isSafeInternalReturnPath("/flight")).toBe(false);
    });

    it("test_flight_with_trailing_slash_returns_false", () => {
      expect(isSafeInternalReturnPath("/flight/")).toBe(false);
    });

    it("test_non_flight_internal_path_returns_false", () => {
      expect(isSafeInternalReturnPath("/admin/users")).toBe(false);
    });

    it("test_absolute_external_url_returns_false", () => {
      expect(isSafeInternalReturnPath("https://evil.example.com/flight/plans")).toBe(false);
    });

    it("test_protocol_relative_url_returns_false", () => {
      expect(isSafeInternalReturnPath("//evil.example.com/flight/plans")).toBe(false);
    });

    it("test_path_traversal_returns_false", () => {
      expect(isSafeInternalReturnPath("/flight/../admin")).toBe(false);
    });

    it("test_percent_encoded_traversal_returns_false", () => {
      expect(isSafeInternalReturnPath("/flight/%2e%2e/admin")).toBe(false);
    });

    it("test_query_string_returns_false", () => {
      // リダイレクト時に ?dips=linked を安全に付与するため、クエリ付きは拒否する
      expect(isSafeInternalReturnPath("/flight/plans?x=1")).toBe(false);
    });

    it("test_fragment_returns_false", () => {
      expect(isSafeInternalReturnPath("/flight/plans#frag")).toBe(false);
    });

    it("test_backslash_returns_false", () => {
      expect(isSafeInternalReturnPath("/flight/plans\\evil")).toBe(false);
    });

    it("test_empty_segment_returns_false", () => {
      expect(isSafeInternalReturnPath("/flight//plans")).toBe(false);
    });

    it("test_control_character_returns_false", () => {
      expect(isSafeInternalReturnPath("/flight/plans\n")).toBe(false);
    });

    it("test_overlong_path_returns_false", () => {
      expect(isSafeInternalReturnPath(`/flight/plans/${"a".repeat(600)}`)).toBe(false);
    });
  });
});
