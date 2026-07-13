import { describe, it, expect, afterEach, vi } from "vitest";

/**
 * UPLOAD_BASE_DIR は環境変数 (UPLOAD_BASE_DIR) で上書き可能。
 * モジュール評価時に env を読むため、各ケースで env を差し替えてから
 * resetModules + 動的 import で再評価する。
 */
describe("UPLOAD_BASE_DIR resolution", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  async function loadUploadBaseDir(): Promise<string> {
    vi.resetModules();
    const mod = await import("@/lib/upload");
    return mod.UPLOAD_BASE_DIR;
  }

  it("test_uses_env_value_when_set", async () => {
    vi.stubEnv("UPLOAD_BASE_DIR", "/custom/uploads/");

    expect(await loadUploadBaseDir()).toBe("/custom/uploads/");
  });

  it("test_falls_back_to_default_when_unset", async () => {
    vi.stubEnv("UPLOAD_BASE_DIR", "");
    // stubEnv("") はキー削除ではなく空文字設定だが、空文字は既定へフォールバックする
    expect(await loadUploadBaseDir()).toBe("/home/ubuntu/uploads/");
  });

  it("test_falls_back_to_default_when_whitespace_only", async () => {
    vi.stubEnv("UPLOAD_BASE_DIR", "   ");

    expect(await loadUploadBaseDir()).toBe("/home/ubuntu/uploads/");
  });

  it("test_trims_surrounding_whitespace_from_env_value", async () => {
    vi.stubEnv("UPLOAD_BASE_DIR", "  /data/uploads/  ");

    expect(await loadUploadBaseDir()).toBe("/data/uploads/");
  });
});
