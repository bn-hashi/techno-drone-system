import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { DipsNotifyButton } from "@/components/flight/plans/DipsNotifyButton";
import { DipsAuthRequiredClientError, dipsLoginUrl } from "@/lib/api/dips";
import type { DipsNotificationResult } from "@/lib/api/dips";

// router.refresh / replace の呼び出しを検証するため useRouter 等をモックする
const mockRefresh = vi.fn();
const mockReplace = vi.fn();
let mockSearchParamsValue = "";
// 実際の useRouter / useSearchParams はレンダー間で同一の参照を返す。テストの mock も
// 同様にしないと依存配列の参照比較が毎回変化し、effect が無限ループしてしまう。
let mockSearchParamsInstance = new URLSearchParams(mockSearchParamsValue);
const mockRouterInstance = { refresh: mockRefresh, replace: mockReplace };
vi.mock("next/navigation", () => ({
  useRouter: () => mockRouterInstance,
  usePathname: () => "/flight/plans/plan-1",
  useSearchParams: () => mockSearchParamsInstance,
}));

// vi.mock はホイストされるため vi.hoisted で先に用意する
const mockNotifyFlightPlanToDips = vi.hoisted(() => vi.fn());
vi.mock("@/lib/api/dips", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api/dips")>("@/lib/api/dips");
  return {
    ...actual,
    notifyFlightPlanToDips: mockNotifyFlightPlanToDips,
  };
});

const PENDING_NOTIFY_STORAGE_KEY = "dips:pendingNotifyForm";

const SAMPLE_RESULT: DipsNotificationResult = {
  flightPlanId: "dips-123",
  flightPlanRegistrationResult: "OK",
  flightPlanRegistrationDatetime: "2026-07-19 10:00",
};

/** 復元対象のフォーム内容 (妥当な入力) を sessionStorage に退避する */
function savePendingFormToSessionStorage(planId: string): void {
  window.sessionStorage.setItem(
    PENDING_NOTIFY_STORAGE_KEY,
    JSON.stringify({
      planId,
      form: {
        flightPurpose: [1],
        flightAirspace: "1",
        assistantsNumber: "1",
        departurePoint: "東京都千代田区",
        destinationPoint: "東京都港区",
        flightSpeed: "10",
        flightAltitude: "50",
        centerLongitude: "139.7",
        centerLatitude: "35.6",
        radiusMeters: "100",
        riskMitigationOnsiteControl: true,
      },
    })
  );
}

describe("DipsNotifyButton", () => {
  beforeEach(() => {
    mockRefresh.mockReset();
    mockReplace.mockReset();
    mockNotifyFlightPlanToDips.mockReset();
    mockSearchParamsValue = "";
    mockSearchParamsInstance = new URLSearchParams(mockSearchParamsValue);
    window.sessionStorage.clear();
  });

  /** 各テストで dips クエリを設定する際は、参照を安定させたまま値を更新する */
  function setDipsQuery(value: string): void {
    mockSearchParamsValue = value;
    mockSearchParamsInstance = new URLSearchParams(value);
  }

  /**
   * 退避フォームありで OAuth 連携成功 (?dips=linked) を再現し、自動再送信の
   * API 呼び出しが発生するまで待つ (Arrange + Act の共有部分)。各テストは
   * このあと 1 つの観点のみを Assert する。
   */
  async function renderAndWaitForAutoResubmit(): Promise<void> {
    savePendingFormToSessionStorage("plan-1");
    setDipsQuery("dips=linked");
    mockNotifyFlightPlanToDips.mockResolvedValue(SAMPLE_RESULT);

    render(<DipsNotifyButton planId="plan-1" dipsFlightPlanId={null} />);

    await waitFor(() => {
      expect(mockNotifyFlightPlanToDips).toHaveBeenCalled();
    });
  }

  it("test_DipsNotifyButton_oauth_return_linked_calls_notify_exactly_once", async () => {
    await renderAndWaitForAutoResubmit();

    expect(mockNotifyFlightPlanToDips).toHaveBeenCalledTimes(1);
  });

  it("test_DipsNotifyButton_oauth_return_linked_calls_notify_with_restored_form_data", async () => {
    await renderAndWaitForAutoResubmit();

    expect(mockNotifyFlightPlanToDips).toHaveBeenCalledWith(
      "plan-1",
      expect.objectContaining({ departurePoint: "東京都千代田区" })
    );
  });

  it("test_DipsNotifyButton_oauth_return_linked_shows_success_banner_after_resubmit", async () => {
    await renderAndWaitForAutoResubmit();

    await waitFor(() => {
      expect(screen.getByRole("status")).toHaveTextContent(
        "DIPS連携が完了し、飛行計画の通報を自動で送信しました。"
      );
    });
  });

  it("test_DipsNotifyButton_oauth_return_linked_calls_router_refresh_after_resubmit_success", async () => {
    await renderAndWaitForAutoResubmit();

    await waitFor(() => {
      expect(mockRefresh).toHaveBeenCalled();
    });
  });

  /**
   * バックグラウンドの自動再送信が act() の外で状態更新しないよう、テスト終了前に
   * 完了 (成功時の router.refresh 呼び出し) まで待つ。呼び出し回数・引数等の検証は
   * 他のテストが担うため、ここではアサーションを重ねずポーリングのみに留める。
   * (notifyFlightPlanToDips が呼ばれた時点ではまだ Promise 解決前の途中状態のため、
   * 呼び出し開始だけを見ると後続の状態更新が act() の外で走る可能性がある)
   */
  async function waitForAutoResubmitToSettle(): Promise<void> {
    await waitFor(() => {
      if (mockRefresh.mock.calls.length === 0) {
        throw new Error("自動再送信の完了 (router.refresh) がまだ確認できません");
      }
    });
  }

  it("test_DipsNotifyButton_oauth_return_linked_clears_pending_storage_synchronously", async () => {
    savePendingFormToSessionStorage("plan-1");
    setDipsQuery("dips=linked");
    mockNotifyFlightPlanToDips.mockResolvedValue(SAMPLE_RESULT);

    render(<DipsNotifyButton planId="plan-1" dipsFlightPlanId={null} />);

    // 機微情報を含みうる退避フォームは、自動再送信の成否を待たず即座に破棄される
    expect(window.sessionStorage.getItem(PENDING_NOTIFY_STORAGE_KEY)).toBeNull();

    await waitForAutoResubmitToSettle();
  });

  /** 自動再送信が失敗するケースを再現し、API 呼び出しが発生するまで待つ */
  async function renderAndWaitForAutoResubmitFailure(): Promise<void> {
    savePendingFormToSessionStorage("plan-1");
    setDipsQuery("dips=linked");
    mockNotifyFlightPlanToDips.mockRejectedValue(new Error("DIPSサーバーエラー"));

    render(<DipsNotifyButton planId="plan-1" dipsFlightPlanId={null} />);

    await waitFor(() => {
      expect(mockNotifyFlightPlanToDips).toHaveBeenCalled();
    });
  }

  it("test_DipsNotifyButton_auto_resubmit_failure_shows_error_banner_for_manual_retry", async () => {
    await renderAndWaitForAutoResubmitFailure();

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(
        /通報の自動再送信に失敗しました.*再度「通報する」を押してください/
      );
    });
  });

  it("test_DipsNotifyButton_auto_resubmit_failure_keeps_manual_submit_button_enabled", async () => {
    await renderAndWaitForAutoResubmitFailure();

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "通報する" })).toBeEnabled();
    });
  });

  /** 自動再送信を意図的に未解決のまま止め、進行中の状態を検証できるようにする */
  function renderWithPendingResubmit(): { resolve: (value: DipsNotificationResult) => void } {
    savePendingFormToSessionStorage("plan-1");
    setDipsQuery("dips=linked");
    let resolveNotify: (value: DipsNotificationResult) => void = () => {};
    mockNotifyFlightPlanToDips.mockImplementation(
      () =>
        new Promise<DipsNotificationResult>((resolve) => {
          resolveNotify = resolve;
        })
    );

    render(<DipsNotifyButton planId="plan-1" dipsFlightPlanId={null} />);

    return { resolve: (value) => resolveNotify(value) };
  }

  it("test_DipsNotifyButton_auto_resubmit_disables_submit_button_while_in_flight", async () => {
    renderWithPendingResubmit();

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "通報中..." })).toBeDisabled();
    });
  });

  it("test_DipsNotifyButton_auto_resubmit_does_not_call_notify_more_than_once_while_in_flight", async () => {
    renderWithPendingResubmit();
    await waitFor(() => screen.getByRole("button", { name: "通報中..." }));

    // 送信中に呼び出しが積み増しされていない (二重送信防止)
    expect(mockNotifyFlightPlanToDips).toHaveBeenCalledTimes(1);
  });

  it("test_DipsNotifyButton_auto_resubmit_closes_dialog_after_resubmit_resolves", async () => {
    const { resolve } = renderWithPendingResubmit();
    await waitFor(() => screen.getByRole("button", { name: "通報中..." }));

    resolve(SAMPLE_RESULT);

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
  });

  /** 退避フォームなしで OAuth 連携成功を再現する */
  async function renderLinkedWithoutSavedForm(): Promise<void> {
    setDipsQuery("dips=linked");

    render(<DipsNotifyButton planId="plan-1" dipsFlightPlanId={null} />);

    await waitFor(() => screen.getByRole("status"));
  }

  it("test_DipsNotifyButton_oauth_return_linked_without_saved_form_shows_success_banner", async () => {
    await renderLinkedWithoutSavedForm();

    expect(screen.getByRole("status")).toHaveTextContent("DIPS連携が完了しました。");
  });

  it("test_DipsNotifyButton_oauth_return_linked_without_saved_form_does_not_call_notify", async () => {
    await renderLinkedWithoutSavedForm();

    expect(mockNotifyFlightPlanToDips).not.toHaveBeenCalled();
  });

  it("test_DipsNotifyButton_oauth_return_linked_without_saved_form_does_not_open_dialog", async () => {
    await renderLinkedWithoutSavedForm();

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  /** OAuth 連携失敗 (state_error) を、退避フォームがある状態で再現する */
  async function renderOauthFailureWithSavedForm(): Promise<void> {
    savePendingFormToSessionStorage("plan-1");
    setDipsQuery("dips=state_error");

    render(<DipsNotifyButton planId="plan-1" dipsFlightPlanId={null} />);

    await waitFor(() => screen.getByRole("alert"));
  }

  it("test_DipsNotifyButton_oauth_return_failure_shows_state_error_banner", async () => {
    await renderOauthFailureWithSavedForm();

    expect(screen.getByRole("alert")).toHaveTextContent("DIPS連携の検証に失敗しました");
  });

  it("test_DipsNotifyButton_oauth_return_failure_does_not_call_notify", async () => {
    await renderOauthFailureWithSavedForm();

    expect(mockNotifyFlightPlanToDips).not.toHaveBeenCalled();
  });

  it("test_DipsNotifyButton_oauth_return_replaces_url_preserving_other_query_params", async () => {
    setDipsQuery("dips=linked&page=2");

    render(<DipsNotifyButton planId="plan-1" dipsFlightPlanId={null} />);

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith("/flight/plans/plan-1?page=2", { scroll: false });
    });
  });

  describe("手動送信 (「通報する」ボタン)", () => {
    /** ダイアログを開き、送信検証を通過する最小限の入力を埋める */
    function openDialogAndFillValidForm(): void {
      fireEvent.click(screen.getByRole("button", { name: "DIPSへ通報" }));
      fireEvent.click(screen.getByLabelText("空撮"));
      fireEvent.change(screen.getByLabelText("飛行空域種別 (カンマ区切り)"), {
        target: { value: "1" },
      });
      fireEvent.change(screen.getByLabelText("補助者人数"), { target: { value: "1" } });
      fireEvent.change(screen.getByLabelText("飛行速度 (km/h)"), { target: { value: "10" } });
      fireEvent.change(screen.getByLabelText("出発地"), { target: { value: "東京都千代田区" } });
      fireEvent.change(screen.getByLabelText("目的地"), { target: { value: "東京都港区" } });
      fireEvent.change(screen.getByLabelText("飛行高度 (AGL メートル)"), { target: { value: "50" } });
      fireEvent.change(screen.getByLabelText("経度"), { target: { value: "139.7" } });
      fireEvent.change(screen.getByLabelText("緯度"), { target: { value: "35.6" } });
      fireEvent.change(screen.getByLabelText("半径 (m)"), { target: { value: "100" } });
    }

    /** 送信成功後、ダイアログが閉じるまで待つ (Act の完了待ち。Assert はテスト側で行う) */
    async function waitForDialogToClose(): Promise<void> {
      await waitFor(() => {
        if (screen.queryByRole("dialog")) {
          throw new Error("送信成功後もダイアログが閉じていません");
        }
      });
    }

    it("test_DipsNotifyButton_manual_submit_success_reenables_submit_button_after_reopening_dialog", async () => {
      mockNotifyFlightPlanToDips.mockResolvedValue(SAMPLE_RESULT);
      render(<DipsNotifyButton planId="plan-1" dipsFlightPlanId={null} />);
      openDialogAndFillValidForm();

      fireEvent.click(screen.getByRole("button", { name: "通報する" }));
      await waitForDialogToClose();
      // isSubmitting はダイアログの開閉に連動してリセットされないため、
      // 成功後もリセットされていなければ再度開いたときに「通報中...」のまま無効化され続ける
      fireEvent.click(screen.getByRole("button", { name: "DIPSへ通報" }));

      expect(screen.getByRole("button", { name: "通報する" })).toBeEnabled();
    });

    describe("DipsAuthRequiredClientError 発生時", () => {
      // jsdom は window.location.href への代入で実ナビゲーションを試みて
      // 何もせず失敗する (Not implemented: navigation) ため、代入結果を検証できるよう
      // window.location をプレーンオブジェクトに差し替える
      const originalLocation = window.location;

      beforeEach(() => {
        Object.defineProperty(window, "location", {
          configurable: true,
          value: { ...originalLocation, pathname: "/flight/plans/plan-1", search: "?page=2", href: "" },
        });
      });

      afterEach(() => {
        Object.defineProperty(window, "location", {
          configurable: true,
          value: originalLocation,
        });
      });

      /** ログイン画面へのリダイレクト (window.location.href への代入) が発生するまで待つ */
      async function waitForLoginRedirect(): Promise<void> {
        await waitFor(() => {
          if (window.location.href === "") {
            throw new Error("ログイン画面へのリダイレクトがまだ発生していません");
          }
        });
      }

      it("test_DipsNotifyButton_manual_submit_auth_required_returnPath_excludes_query_string", async () => {
        mockNotifyFlightPlanToDips.mockRejectedValue(new DipsAuthRequiredClientError("fpl"));
        render(<DipsNotifyButton planId="plan-1" dipsFlightPlanId={null} />);
        openDialogAndFillValidForm();

        fireEvent.click(screen.getByRole("button", { name: "通報する" }));
        await waitForLoginRedirect();

        // クエリ文字列 (?page=2) を含めると isSafeInternalReturnPath がサーバー側で
        // 拒否するため、pathname 単独であることを固定する (クエリ保持修正の revert)
        expect(window.location.href).toBe(dipsLoginUrl("fpl", "/flight/plans/plan-1"));
      });
    });
  });
});
