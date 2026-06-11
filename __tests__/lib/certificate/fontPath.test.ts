// @vitest-environment node
import { describe, it, expect, afterEach } from "vitest";
import { resolveNotoSansJpFontPath, CERTIFICATE_FONT_PATH_ENV } from "@/lib/certificate/fontPath";

describe("resolveNotoSansJpFontPath", () => {
  afterEach(() => {
    delete process.env[CERTIFICATE_FONT_PATH_ENV];
  });

  it("test_resolve_default_returns_existing_fontsource_path", () => {
    delete process.env[CERTIFICATE_FONT_PATH_ENV];
    expect(resolveNotoSansJpFontPath()).toContain("@fontsource/noto-sans-jp");
  });

  it("test_resolve_with_env_override_returns_override_path", () => {
    // 存在する任意ファイルを上書き先に使う
    const override = `${process.cwd()}/package.json`;
    process.env[CERTIFICATE_FONT_PATH_ENV] = override;
    expect(resolveNotoSansJpFontPath()).toBe(override);
  });

  it("test_resolve_missing_font_throws_clear_error", () => {
    process.env[CERTIFICATE_FONT_PATH_ENV] = "/nonexistent/path/to/font.woff";
    expect(() => resolveNotoSansJpFontPath()).toThrowError(/見つかりません/);
  });
});
