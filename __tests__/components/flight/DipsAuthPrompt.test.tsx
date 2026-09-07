import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { DipsAuthPrompt } from "@/components/flight/DipsAuthPrompt";
import { AppSessionExpiredPrompt } from "@/components/flight/AppSessionExpiredPrompt";

/**
 * `DipsAuthPrompt` / `AppSessionExpiredPrompt` は `DipsAircraftPickerModal.tsx` /
 * `DipsVerifyButton.tsx` / `DipsPermissionsPanel.tsx` の3箇所に複製されていた
 * ログイン誘導 JSX を1本化した共通コンポーネント (2026-08-28 段階2共通化)。
 * 呼び出し元ごとの差分 (余白クラス・role/aria-live) を props で吸収できることを
 * 直接検証する。5-3/5-4/5-5 がこのコンポーネントをそのまま再利用できる根拠にもなる。
 */
describe("DipsAuthPrompt", () => {
  it("test_renders_dips_login_link_with_realm_and_return_path", () => {
    render(<DipsAuthPrompt realm="utm" returnPath="/flight/aircraft/1" />);

    const link = screen.getByRole("link", { name: "DIPSにログインする" });
    expect(link).toHaveAttribute("href", expect.stringContaining("realm=utm"));
    expect(link).toHaveAttribute("href", expect.stringContaining("returnPath="));
  });

  it("test_omits_role_and_aria_live_by_default", () => {
    render(<DipsAuthPrompt realm="req" />);

    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("test_applies_role_and_aria_live_when_passed", () => {
    render(<DipsAuthPrompt realm="req" role="status" ariaLive="polite" />);

    const status = screen.getByRole("status");
    expect(status).toHaveAttribute("aria-live", "polite");
  });

  it("test_applies_caller_supplied_className", () => {
    const { container } = render(<DipsAuthPrompt realm="req" className="mt-4 text-sm text-gray-700" />);

    expect(container.querySelector("p")).toHaveClass("mt-4", "text-sm", "text-gray-700");
  });
});

describe("AppSessionExpiredPrompt", () => {
  it("test_renders_app_login_link", () => {
    render(<AppSessionExpiredPrompt />);

    const link = screen.getByRole("link", { name: "ログイン画面へ" });
    expect(link).toHaveAttribute("href", "/login");
  });

  it("test_applies_role_and_aria_live_when_passed", () => {
    render(<AppSessionExpiredPrompt role="status" ariaLive="polite" />);

    expect(screen.getByRole("status")).toBeInTheDocument();
  });
});
