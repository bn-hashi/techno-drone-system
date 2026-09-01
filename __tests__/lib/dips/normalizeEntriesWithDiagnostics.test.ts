import { describe, it, expect, vi, afterEach } from "vitest";
import { z } from "zod";
import {
  describeReceivedType,
  normalizeEntriesWithDiagnostics,
} from "@/lib/dips/normalizeEntriesWithDiagnostics";
import { DipsApiError } from "@/lib/dips/errors";
import { logger } from "@/lib/logger";

/**
 * `normalizeEntriesWithDiagnostics` は5-1 (機体情報一覧取得) と5-2 (許可・承認情報取得) の
 * 正規化機構を1本化した共通エンジン (2026-08-28 段階2共通化)。両 API のフィクスチャに
 * 依存せず、エンジン自体の契約 (エントリ単位フォールバック・PII を含まないログ・C1 の
 * 空パス代替) を直接検証する。5-3/5-4/5-5 が同じ契約に乗れることの確認も兼ねる。
 */

const EntrySchema = z.object({ id: z.string(), secretValue: z.string().optional() });
type Entry = z.infer<typeof EntrySchema>;

function extractTopLevelArray(raw: unknown): unknown[] {
  if (!Array.isArray(raw)) {
    throw new DipsApiError(`テスト対象のレスポンス形式が不正です (受信した型: ${describeReceivedType(raw)})`);
  }
  return raw;
}

const baseOptions = {
  entrySchema: EntrySchema,
  extractArray: extractTopLevelArray,
  subject: "テスト対象",
  route: "normalizeTestEntries",
};

describe("normalizeEntriesWithDiagnostics", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("test_returns_all_entries_with_zero_excluded_count_when_all_valid", () => {
    const result = normalizeEntriesWithDiagnostics<Entry>([{ id: "a" }, { id: "b" }], baseOptions);

    expect(result).toEqual({ entries: [{ id: "a" }, { id: "b" }], excludedCount: 0 });
  });

  it("test_treats_empty_array_as_a_valid_zero_entry_response", () => {
    const result = normalizeEntriesWithDiagnostics<Entry>([], baseOptions);

    expect(result).toEqual({ entries: [], excludedCount: 0 });
  });

  it("test_drops_only_the_invalid_entry_and_keeps_the_others", () => {
    const spy = vi.spyOn(logger, "error").mockImplementation(() => {});

    const result = normalizeEntriesWithDiagnostics<Entry>(
      [{ id: "a" }, { id: 123 }, { id: "c" }],
      baseOptions
    );

    expect(result.entries).toEqual([{ id: "a" }, { id: "c" }]);
    expect(result.excludedCount).toBe(1);
    expect(spy).toHaveBeenCalledOnce();
  });

  it("test_does_not_call_logger_when_every_entry_parses_successfully", () => {
    const spy = vi.spyOn(logger, "error").mockImplementation(() => {});

    normalizeEntriesWithDiagnostics<Entry>([{ id: "a" }], baseOptions);

    expect(spy).not.toHaveBeenCalled();
  });

  it("test_throws_dips_api_error_when_every_entry_fails_to_parse", () => {
    vi.spyOn(logger, "error").mockImplementation(() => {});

    expect(() =>
      normalizeEntriesWithDiagnostics<Entry>([{ id: 1 }, { id: 2 }], baseOptions)
    ).toThrow(DipsApiError);
  });

  it("test_all_failed_error_message_includes_subject_and_total_count", () => {
    vi.spyOn(logger, "error").mockImplementation(() => {});

    expect(() => normalizeEntriesWithDiagnostics<Entry>([{ id: 1 }, { id: 2 }], baseOptions)).toThrow(
      /テスト対象の全2件のエントリでパースに失敗しました/
    );
  });

  it("test_propagates_extract_array_error_for_malformed_top_level_response", () => {
    expect(() => normalizeEntriesWithDiagnostics<Entry>({ not: "an array" }, baseOptions)).toThrow(
      /受信した型: object/
    );
  });

  describe("PII 方針: ログ・例外メッセージに受信値そのものを含めない", () => {
    it("test_log_context_contains_only_index_and_key_names_not_the_raw_value", () => {
      const spy = vi.spyOn(logger, "error").mockImplementation(() => {});

      normalizeEntriesWithDiagnostics<Entry>(
        [{ id: "a" }, { id: 123, secretValue: "PIIプローブ値" }],
        baseOptions
      );

      const [messageArg, errorArg, context] = spy.mock.calls[0] as [
        string,
        unknown,
        Record<string, unknown>,
      ];
      expect(messageArg).toContain("1/2");
      expect(errorArg).toBeUndefined();
      expect(context).toMatchObject({
        route: "normalizeTestEntries",
        droppedEntries: [{ index: 1, issuePaths: ["id"] }],
      });
      expect(JSON.stringify(context)).not.toContain("PIIプローブ値");
    });

    it("test_all_failed_error_message_does_not_contain_the_raw_value", () => {
      vi.spyOn(logger, "error").mockImplementation(() => {});

      try {
        normalizeEntriesWithDiagnostics<Entry>([{ id: 1, secretValue: "PIIプローブ値" }], baseOptions);
        throw new Error("この行に到達してはならない (前の行で throw されるはず)");
      } catch (error) {
        expect((error as DipsApiError).message).not.toContain("PIIプローブ値");
      }
    });
  });

  describe("C1: エントリ自体がオブジェクトでないときのパス代替 (対象キーが空欄にならない)", () => {
    it("test_falls_back_to_received_type_and_zod_code_when_issue_path_is_empty", () => {
      // 全件失敗させると別分岐 (DipsApiError) に入ってしまうため、他に1件成功する
      // エントリを混ぜて「一部除外」のログ経路を通す
      const spy = vi.spyOn(logger, "error").mockImplementation(() => {});

      normalizeEntriesWithDiagnostics<Entry>(["not-an-object", { id: "ok" }], baseOptions);

      const [, , context] = spy.mock.calls[0] as [string, unknown, { droppedEntries: Array<{ issuePaths: string[] }> }];
      const [issuePath] = context.droppedEntries[0].issuePaths;
      expect(issuePath).toContain("受信した型: string");
      expect(issuePath).toContain("code:");
    });

    it("test_all_failed_error_message_still_reports_a_target_key_when_paths_are_empty", () => {
      expect(() => normalizeEntriesWithDiagnostics<Entry>(["not-an-object"], baseOptions)).toThrow(
        /対象キー: \(受信した型: string, code: \w+\)/
      );
    });
  });
});

describe("describeReceivedType", () => {
  it.each([
    [null, "null"],
    [[1, 2], "array"],
    [{ a: 1 }, "object"],
    ["text", "string"],
    [42, "number"],
    [true, "boolean"],
    [undefined, "undefined"],
  ])("test_describes_%s_as_%s", (value, expected) => {
    expect(describeReceivedType(value)).toBe(expected);
  });
});
