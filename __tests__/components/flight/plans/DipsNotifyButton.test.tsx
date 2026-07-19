import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { DipsNotifyButton } from "@/components/flight/plans/DipsNotifyButton";

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

  it("test_DipsNotifyButton_oauth_return_linked_with_saved_form_auto_resubmits_and_records_result", async () => {
    savePendingFormToSessionStorage("plan-1");
    setDipsQuery("dips=linked");
    mockNotifyFlightPlanToDips.mockResolvedValue({
      flightPlanId: "dips-123",
      flightPlanRegistrationResult: "OK",
      flightPlanRegistrationDatetime: "2026-07-19 10:00",
    });

    render(<DipsNotifyButton planId="plan-1" dipsFlightPlanId={null} />);

    await waitFor(() => {
      expect(mockNotifyFlightPlanToDips).toHaveBeenCalledTimes(1);
    });
    expect(mockNotifyFlightPlanToDips).toHaveBeenCalledWith(
      "plan-1",
      expect.objectContaining({ departurePoint: "東京都千代田区" })
    );

    await waitFor(() => {
      expect(screen.getByRole("status")).toHaveTextContent(
        "DIPS連携が完了し、飛行計画の通報を自動で送信しました。"
      );
    });
    expect(mockRefresh).toHaveBeenCalled();
  });

  it("test_DipsNotifyButton_oauth_return_linked_clears_pending_storage_before_resubmit", async () => {
    savePendingFormToSessionStorage("plan-1");
    setDipsQuery("dips=linked");
    mockNotifyFlightPlanToDips.mockResolvedValue({
      flightPlanId: "dips-123",
      flightPlanRegistrationResult: "OK",
      flightPlanRegistrationDatetime: "2026-07-19 10:00",
    });

    render(<DipsNotifyButton planId="plan-1" dipsFlightPlanId={null} />);

    await waitFor(() => {
      expect(mockNotifyFlightPlanToDips).toHaveBeenCalledTimes(1);
    });

    // 機微情報を含みうる退避フォームは、自動再送信の成否によらず即座に破棄される
    expect(window.sessionStorage.getItem(PENDING_NOTIFY_STORAGE_KEY)).toBeNull();
  });

  it("test_DipsNotifyButton_auto_resubmit_failure_shows_error_banner_for_manual_retry", async () => {
    savePendingFormToSessionStorage("plan-1");
    setDipsQuery("dips=linked");
    mockNotifyFlightPlanToDips.mockRejectedValue(new Error("DIPSサーバーエラー"));

    render(<DipsNotifyButton planId="plan-1" dipsFlightPlanId={null} />);

    await waitFor(() => {
      expect(mockNotifyFlightPlanToDips).toHaveBeenCalledTimes(1);
    });

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(
        /通報の自動再送信に失敗しました.*再度「通報する」を押してください/
      );
    });
    // 失敗後もダイアログは開いたままで、手動での再送信ボタンが有効になっている
    expect(screen.getByRole("button", { name: "通報する" })).toBeEnabled();
  });

  it("test_DipsNotifyButton_auto_resubmit_disables_submit_button_while_in_flight", async () => {
    savePendingFormToSessionStorage("plan-1");
    setDipsQuery("dips=linked");
    let resolveNotify: (value: {
      flightPlanId: string;
      flightPlanRegistrationResult: string;
      flightPlanRegistrationDatetime: string;
    }) => void = () => {};
    mockNotifyFlightPlanToDips.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveNotify = resolve;
        })
    );

    render(<DipsNotifyButton planId="plan-1" dipsFlightPlanId={null} />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "通報中..." })).toBeDisabled();
    });
    // 送信中に呼び出しが積み増しされていない (二重送信防止)
    expect(mockNotifyFlightPlanToDips).toHaveBeenCalledTimes(1);

    resolveNotify({
      flightPlanId: "dips-123",
      flightPlanRegistrationResult: "OK",
      flightPlanRegistrationDatetime: "2026-07-19 10:00",
    });
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
  });

  it("test_DipsNotifyButton_oauth_return_linked_without_saved_form_shows_banner_only", async () => {
    setDipsQuery("dips=linked");

    render(<DipsNotifyButton planId="plan-1" dipsFlightPlanId={null} />);

    await waitFor(() => {
      expect(screen.getByRole("status")).toHaveTextContent("DIPS連携が完了しました。");
    });
    expect(mockNotifyFlightPlanToDips).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("test_DipsNotifyButton_oauth_return_failure_does_not_auto_resubmit", async () => {
    savePendingFormToSessionStorage("plan-1");
    setDipsQuery("dips=state_error");

    render(<DipsNotifyButton planId="plan-1" dipsFlightPlanId={null} />);

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("DIPS連携の検証に失敗しました");
    });
    expect(mockNotifyFlightPlanToDips).not.toHaveBeenCalled();
  });
});
