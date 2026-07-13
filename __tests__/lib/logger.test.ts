import { describe, it, expect, afterEach, vi } from "vitest";

/**
 * logger.error の挙動テスト
 *
 * - テスト実行時は無音（エラー系テストの出力を汚さない）
 * - 本番/開発では stderr へ出すが、例外は name/message/stack のみに絞り、
 *   独自プロパティ（PII を含みうる）を露出しない
 *
 * isTest はモジュール評価時に NODE_ENV を読むため、非テスト挙動の検証は
 * env を差し替えてから resetModules + 動的 import で再評価する。
 */
describe("logger.error", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
    vi.restoreAllMocks();
  });

  async function loadLoggerAsProduction() {
    vi.resetModules();
    vi.stubEnv("NODE_ENV", "production");
    const mod = await import("@/lib/logger");
    return mod.logger;
  }

  it("test_is_silent_in_test_env", async () => {
    vi.resetModules();
    vi.stubEnv("NODE_ENV", "test");
    const { logger } = await import("@/lib/logger");
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});

    logger.error("何か失敗", new Error("boom"));

    expect(spy).not.toHaveBeenCalled();
  });

  it("test_serializes_error_to_name_message_stack_only", async () => {
    const logger = await loadLoggerAsProduction();
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const error = Object.assign(new Error("boom"), { piiField: "secret-value" });

    logger.error("何か失敗", error, { route: "GET /x" });

    expect(spy).toHaveBeenCalledOnce();
    const payload = spy.mock.calls[0][1] as { error: Record<string, unknown> };
    expect(payload.error).toHaveProperty("name", "Error");
    expect(payload.error).toHaveProperty("message", "boom");
    expect(payload.error).toHaveProperty("stack");
    // 独自プロパティ（PII を含みうる）は出力しない
    expect(payload.error).not.toHaveProperty("piiField");
  });

  it("test_stringifies_non_error_value", async () => {
    const logger = await loadLoggerAsProduction();
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});

    logger.error("何か失敗", "just a string");

    const payload = spy.mock.calls[0][1] as { error: unknown };
    expect(payload.error).toBe("just a string");
  });

  it("test_preserves_context_field", async () => {
    const logger = await loadLoggerAsProduction();
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});

    logger.error("何か失敗", new Error("boom"), { route: "POST /api/admin/users" });

    const payload = spy.mock.calls[0][1] as { context: unknown };
    expect(payload.context).toEqual({ route: "POST /api/admin/users" });
  });
});
