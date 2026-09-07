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

/** 「テスト申請を送信」→ 確認ステップの「送信する」まで進める共通ヘルパー */
async function clickSubmitAndConfirm(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: "テスト申請を送信" }));
  await user.click(screen.getByRole("button", { name: "送信する" }));
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

  // I2 (2026-09-06 レビュー): 実申請の送信には確認ステップを挟む (window.confirm は
  // 使わずインライン確認)。以前は「テスト申請を送信」ボタン1つで即座に送信していた
  // (実装前に本テストを実行し、即座に送信されて Red になることを確認済み)。
  it("test_panel_requires_confirmation_before_submitting", async () => {
    mockApplyDipsPermissionTest.mockResolvedValue({ formNum: "Q190100001" });
    const user = userEvent.setup();
    renderWithQuery(<DipsPermissionApplyPanel />);

    await user.click(screen.getByRole("button", { name: "テスト申請を送信" }));

    expect(mockApplyDipsPermissionTest).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "送信する" })).toBeInTheDocument();
  });

  it("test_panel_submits_after_confirmation", async () => {
    mockApplyDipsPermissionTest.mockResolvedValue({ formNum: "Q190100001" });
    const user = userEvent.setup();
    renderWithQuery(<DipsPermissionApplyPanel />);

    await clickSubmitAndConfirm(user);

    expect(mockApplyDipsPermissionTest).toHaveBeenCalledTimes(1);
  });

  it("test_panel_can_cancel_the_confirmation_without_submitting", async () => {
    const user = userEvent.setup();
    renderWithQuery(<DipsPermissionApplyPanel />);

    await user.click(screen.getByRole("button", { name: "テスト申請を送信" }));
    await user.click(screen.getByRole("button", { name: "キャンセル" }));

    expect(mockApplyDipsPermissionTest).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "テスト申請を送信" })).toBeInTheDocument();
  });

  // I2 の核心: 成功後すぐにボタンが再活性化し、2回押すと共用DBに2件登録されていた
  // (実装前に本テストを実行し、Red になることを確認済み)。成功後は送信系ボタンを
  // 一切表示せず「送信済み」表示に固定し、再送にはページの再読み込みを要求する。
  it("test_panel_locks_submission_after_success_and_shows_submitted_state", async () => {
    mockApplyDipsPermissionTest.mockResolvedValue({ formNum: "Q190100001" });
    const user = userEvent.setup();
    renderWithQuery(<DipsPermissionApplyPanel />);

    await clickSubmitAndConfirm(user);
    await screen.findByText(/Q190100001/);

    expect(screen.queryByRole("button", { name: "テスト申請を送信" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "送信する" })).not.toBeInTheDocument();
    expect(screen.getByText(/再送するにはこのページを再読み込みしてください/)).toBeInTheDocument();
  });

  it("test_panel_shows_submitted_message_with_form_num_after_success", async () => {
    mockApplyDipsPermissionTest.mockResolvedValue({ formNum: "Q190100001" });
    const user = userEvent.setup();
    renderWithQuery(<DipsPermissionApplyPanel />);

    await clickSubmitAndConfirm(user);

    expect(await screen.findByText(/送信済み/)).toBeInTheDocument();
    expect(screen.getByText(/Q190100001/)).toBeInTheDocument();
  });

  it("test_panel_shows_dips_auth_prompt_on_auth_required_error", async () => {
    mockApplyDipsPermissionTest.mockRejectedValue(new DipsAuthRequiredClientError("req"));
    const user = userEvent.setup();
    renderWithQuery(<DipsPermissionApplyPanel />);

    await clickSubmitAndConfirm(user);

    expect(await screen.findByText("DIPSへのログインが必要です。")).toBeInTheDocument();
  });

  it("test_panel_shows_app_session_expired_prompt_on_session_expired_error", async () => {
    mockApplyDipsPermissionTest.mockRejectedValue(new AppSessionExpiredClientError());
    const user = userEvent.setup();
    renderWithQuery(<DipsPermissionApplyPanel />);

    await clickSubmitAndConfirm(user);

    expect(await screen.findByText(/ログインが必要です。再度ログインしてください/)).toBeInTheDocument();
  });

  it("test_panel_shows_generic_error_message_on_other_failures", async () => {
    mockApplyDipsPermissionTest.mockRejectedValue(new Error("502エラー"));
    const user = userEvent.setup();
    renderWithQuery(<DipsPermissionApplyPanel />);

    await clickSubmitAndConfirm(user);

    expect(await screen.findByText("502エラー")).toBeInTheDocument();
  });

  it("test_panel_allows_retrying_confirmation_after_a_failure", async () => {
    // 失敗後も再送信できること (ロックは成功時のみ)
    mockApplyDipsPermissionTest.mockRejectedValueOnce(new Error("502エラー"));
    mockApplyDipsPermissionTest.mockResolvedValueOnce({ formNum: "Q190100001" });
    const user = userEvent.setup();
    renderWithQuery(<DipsPermissionApplyPanel />);

    await clickSubmitAndConfirm(user);
    expect(await screen.findByText("502エラー")).toBeInTheDocument();

    await clickSubmitAndConfirm(user);

    expect(await screen.findByText(/Q190100001/)).toBeInTheDocument();
    expect(mockApplyDipsPermissionTest).toHaveBeenCalledTimes(2);
  });

  it("test_panel_disables_confirm_button_while_pending", async () => {
    let resolvePromise: (value: { formNum: string }) => void = () => {};
    mockApplyDipsPermissionTest.mockReturnValue(
      new Promise((resolve) => {
        resolvePromise = resolve;
      })
    );
    const user = userEvent.setup();
    renderWithQuery(<DipsPermissionApplyPanel />);

    await user.click(screen.getByRole("button", { name: "テスト申請を送信" }));
    await user.click(screen.getByRole("button", { name: "送信する" }));

    expect(screen.getByRole("button", { name: "送信中..." })).toBeDisabled();
    resolvePromise({ formNum: "Q190100001" });
  });
});
