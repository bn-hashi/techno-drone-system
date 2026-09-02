import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { DipsPermissionApplyPanel } from "@/app/(flight)/flight/dips-permission-apply/DipsPermissionApplyPanel";

const mockApplyDipsPermissionTest = vi.hoisted(() => vi.fn());
vi.mock("@/lib/api/dips", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api/dips")>("@/lib/api/dips");
  return {
    ...actual,
    applyDipsPermissionTest: mockApplyDipsPermissionTest,
  };
});

import { DipsAuthRequiredClientError, AppSessionExpiredClientError } from "@/lib/api/dips";

function renderWithQuery(ui: React.ReactElement) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

describe("DipsPermissionApplyPanel", () => {
  beforeEach(() => {
    mockApplyDipsPermissionTest.mockReset();
  });

  it("test_panel_does_not_submit_on_initial_render", () => {
    // 検証環境の他事業者共用データベースへ実際に申請データを登録する操作のため、
    // 自動送信は絶対に発生させない
    renderWithQuery(<DipsPermissionApplyPanel />);

    expect(mockApplyDipsPermissionTest).not.toHaveBeenCalled();
  });

  it("test_panel_submits_when_button_clicked", async () => {
    mockApplyDipsPermissionTest.mockResolvedValue({ formNum: "Q190100001" });
    const user = userEvent.setup();
    renderWithQuery(<DipsPermissionApplyPanel />);

    await user.click(screen.getByRole("button", { name: "テスト申請を送信" }));

    expect(mockApplyDipsPermissionTest).toHaveBeenCalledTimes(1);
  });

  it("test_panel_shows_form_num_on_success", async () => {
    mockApplyDipsPermissionTest.mockResolvedValue({ formNum: "Q190100001" });
    const user = userEvent.setup();
    renderWithQuery(<DipsPermissionApplyPanel />);

    await user.click(screen.getByRole("button", { name: "テスト申請を送信" }));

    expect(await screen.findByText(/Q190100001/)).toBeInTheDocument();
  });

  it("test_panel_shows_dips_auth_prompt_on_auth_required_error", async () => {
    mockApplyDipsPermissionTest.mockRejectedValue(new DipsAuthRequiredClientError("req"));
    const user = userEvent.setup();
    renderWithQuery(<DipsPermissionApplyPanel />);

    await user.click(screen.getByRole("button", { name: "テスト申請を送信" }));

    expect(await screen.findByText("DIPSへのログインが必要です。")).toBeInTheDocument();
  });

  it("test_panel_shows_app_session_expired_prompt_on_session_expired_error", async () => {
    mockApplyDipsPermissionTest.mockRejectedValue(new AppSessionExpiredClientError());
    const user = userEvent.setup();
    renderWithQuery(<DipsPermissionApplyPanel />);

    await user.click(screen.getByRole("button", { name: "テスト申請を送信" }));

    expect(await screen.findByText(/ログインが必要です。再度ログインしてください/)).toBeInTheDocument();
  });

  it("test_panel_shows_generic_error_message_on_other_failures", async () => {
    mockApplyDipsPermissionTest.mockRejectedValue(new Error("502エラー"));
    const user = userEvent.setup();
    renderWithQuery(<DipsPermissionApplyPanel />);

    await user.click(screen.getByRole("button", { name: "テスト申請を送信" }));

    expect(await screen.findByText("502エラー")).toBeInTheDocument();
  });

  it("test_panel_disables_button_while_pending", async () => {
    let resolvePromise: (value: { formNum: string }) => void = () => {};
    mockApplyDipsPermissionTest.mockReturnValue(
      new Promise((resolve) => {
        resolvePromise = resolve;
      })
    );
    const user = userEvent.setup();
    renderWithQuery(<DipsPermissionApplyPanel />);

    await user.click(screen.getByRole("button", { name: "テスト申請を送信" }));

    expect(screen.getByRole("button", { name: "送信中..." })).toBeDisabled();
    resolvePromise({ formNum: "Q190100001" });
  });
});
