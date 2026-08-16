import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DipsAircraftPickerModal } from "@/components/flight/aircraft/DipsAircraftPickerModal";
import type { DipsOwnedAircraftDto } from "@/lib/api/dips";

const mockFetchDipsOwnedAircrafts = vi.hoisted(() => vi.fn());
const mockUnlinkDipsAccount = vi.hoisted(() => vi.fn());
vi.mock("@/lib/api/dips", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api/dips")>("@/lib/api/dips");
  return {
    ...actual,
    fetchDipsOwnedAircrafts: mockFetchDipsOwnedAircrafts,
    unlinkDipsAccount: mockUnlinkDipsAccount,
  };
});

import { DipsAuthRequiredClientError, AppSessionExpiredClientError } from "@/lib/api/dips";

const activeAircraft: DipsOwnedAircraftDto = {
  registrationCode: "DUMMY0000001",
  manufacturer: "サンプル製造者01",
  modelNumber: "サンプル型式01",
  serialNumber: "MANUFACT01",
  weightGrams: 24000,
  status: 1,
  deregistrationReason: null,
  validPeriodEnd: "2028-06-19T00:00:00+09:00",
  remoteIdType: 1,
  ownerCategory: 1,
  isSelectable: true,
};

const deregisteredAircraft: DipsOwnedAircraftDto = {
  registrationCode: "DUMMY0000009",
  manufacturer: "サンプル製造者09",
  modelNumber: "サンプル型式09",
  serialNumber: "MANUFACT09",
  weightGrams: 1600,
  status: 3,
  deregistrationReason: 5,
  validPeriodEnd: "2028-06-19T00:00:00+09:00",
  remoteIdType: 2,
  ownerCategory: 1,
  isSelectable: false,
};

describe("DipsAircraftPickerModal", () => {
  beforeEach(() => {
    mockFetchDipsOwnedAircrafts.mockReset();
    mockUnlinkDipsAccount.mockReset();
  });

  it("test_modal_renders_aircraft_rows_from_api", async () => {
    mockFetchDipsOwnedAircrafts.mockResolvedValue({ aircrafts: [activeAircraft], excludedCount: 0 });

    render(
      <DipsAircraftPickerModal isOpen={true} onClose={vi.fn()} onSelect={vi.fn()} />
    );

    expect(await screen.findByText("DUMMY0000001")).toBeInTheDocument();
  });

  it("test_modal_shows_empty_message_when_no_aircraft", async () => {
    mockFetchDipsOwnedAircrafts.mockResolvedValue({ aircrafts: [], excludedCount: 0 });

    render(
      <DipsAircraftPickerModal isOpen={true} onClose={vi.fn()} onSelect={vi.fn()} />
    );

    expect(await screen.findByText("DIPSに登録された機体がありません")).toBeInTheDocument();
  });

  it("test_modal_calls_on_select_with_selected_aircraft", async () => {
    mockFetchDipsOwnedAircrafts.mockResolvedValue({ aircrafts: [activeAircraft], excludedCount: 0 });
    const onSelect = vi.fn();
    const user = userEvent.setup();

    render(
      <DipsAircraftPickerModal isOpen={true} onClose={vi.fn()} onSelect={onSelect} />
    );
    const row = await screen.findByText("DUMMY0000001");
    await user.click(row.closest("button") as HTMLButtonElement);

    expect(onSelect).toHaveBeenCalledWith(activeAircraft);
  });

  it("test_modal_shows_dips_login_link_when_auth_required", async () => {
    mockFetchDipsOwnedAircrafts.mockRejectedValue(new DipsAuthRequiredClientError("utm"));

    render(
      <DipsAircraftPickerModal isOpen={true} onClose={vi.fn()} onSelect={vi.fn()} />
    );

    const link = await screen.findByRole("link", { name: "DIPSにログインする" });
    expect(link).toHaveAttribute("href", expect.stringContaining("realm=utm"));
  });

  it("test_modal_shows_app_login_link_when_app_session_expired", async () => {
    // B4 回帰テスト: requireFlightAccess() が返す素の 401 (アプリのセッション切れ) は
    // DIPS の再認可導線とは別の、アプリのログイン画面への導線を表示する
    mockFetchDipsOwnedAircrafts.mockRejectedValue(new AppSessionExpiredClientError());

    render(
      <DipsAircraftPickerModal isOpen={true} onClose={vi.fn()} onSelect={vi.fn()} />
    );

    const link = await screen.findByRole("link", { name: "ログイン画面へ" });
    expect(link).toHaveAttribute("href", "/login");
  });

  it("test_modal_disables_selection_for_deregistered_aircraft", async () => {
    mockFetchDipsOwnedAircrafts.mockResolvedValue({
      aircrafts: [deregisteredAircraft],
      excludedCount: 0,
    });

    render(
      <DipsAircraftPickerModal isOpen={true} onClose={vi.fn()} onSelect={vi.fn()} />
    );
    const row = await screen.findByText("DUMMY0000009");

    expect(row.closest("button")).toBeDisabled();
  });

  it("test_modal_shows_error_message_on_api_failure", async () => {
    mockFetchDipsOwnedAircrafts.mockRejectedValue(new Error("DIPS機体情報の取得に失敗しました"));

    render(
      <DipsAircraftPickerModal isOpen={true} onClose={vi.fn()} onSelect={vi.fn()} />
    );

    expect(await screen.findByText("DIPS機体情報の取得に失敗しました")).toBeInTheDocument();
  });

  it("test_modal_shows_admin_scope_notice_on_screen", async () => {
    // 「人の決定」論点7: ADMIN は自身の DIPS 機体しか取得できない旨を画面に明示する。
    // 従来は JSDoc のみで画面に出ておらず差し戻しの対象になった (DipsVerifyButton.tsx と
    // 文言を揃える)。
    mockFetchDipsOwnedAircrafts.mockResolvedValue({ aircrafts: [], excludedCount: 0 });

    render(
      <DipsAircraftPickerModal isOpen={true} onClose={vi.fn()} onSelect={vi.fn()} />
    );

    expect(
      screen.getByText("DIPSにログインしたアカウントが所有する機体のみ表示されます")
    ).toBeInTheDocument();
    // fetchDipsOwnedAircrafts の解決による state 更新を待ち、act 警告を防ぐ
    await screen.findByText("DIPSに登録された機体がありません");
  });

  it("test_modal_shows_unknown_label_for_unrecognized_status_code", async () => {
    // クライアント側の寛容パース化 (修正2) に伴う表示側フォールバック。別紙1 未定義の
    // ステータスコードでも画面が壊れず「不明」と表示されることを確認する。
    const unknownStatusAircraft: DipsOwnedAircraftDto = {
      ...activeAircraft,
      registrationCode: "DUMMY0000099",
      status: 99,
    };
    mockFetchDipsOwnedAircrafts.mockResolvedValue({
      aircrafts: [unknownStatusAircraft],
      excludedCount: 0,
    });

    render(
      <DipsAircraftPickerModal isOpen={true} onClose={vi.fn()} onSelect={vi.fn()} />
    );

    expect(await screen.findByText("不明")).toBeInTheDocument();
  });

  it("test_modal_shows_deregistration_reason_suffix_when_reason_code_is_zero", async () => {
    // 回帰テスト (B2 falsy-zero): statusLabel() の `if (aircraft.deregistrationReason)` は
    // 0 を falsy として扱うため、抹消理由が 0 (別紙1 未定義のコード値) の機体では
    // 括弧書きの抹消理由がまるごと欠落していた。null との比較に直すことで、0 でも
    // 「不明」というラベル付きの括弧が表示される
    const zeroReasonAircraft: DipsOwnedAircraftDto = {
      ...deregisteredAircraft,
      registrationCode: "DUMMY0000010",
      deregistrationReason: 0,
    };
    mockFetchDipsOwnedAircrafts.mockResolvedValue({
      aircrafts: [zeroReasonAircraft],
      excludedCount: 0,
    });

    render(
      <DipsAircraftPickerModal isOpen={true} onClose={vi.fn()} onSelect={vi.fn()} />
    );

    expect(await screen.findByText("抹消済み (不明)")).toBeInTheDocument();
  });

  it("test_modal_shows_excluded_count_notice_when_some_aircrafts_were_dropped", async () => {
    // C3 回帰テスト: パースに失敗して除外された機体があるにもかかわらず何も表示されないと
    // 「機体がありません」の空メッセージだけが見え、ユーザーに誤解を与える
    mockFetchDipsOwnedAircrafts.mockResolvedValue({ aircrafts: [activeAircraft], excludedCount: 2 });

    render(
      <DipsAircraftPickerModal isOpen={true} onClose={vi.fn()} onSelect={vi.fn()} />
    );

    expect(await screen.findByText(/2件の機体情報を読み込めませんでした/)).toBeInTheDocument();
  });

  it("test_modal_does_not_show_excluded_count_notice_when_nothing_was_dropped", async () => {
    mockFetchDipsOwnedAircrafts.mockResolvedValue({ aircrafts: [activeAircraft], excludedCount: 0 });

    render(
      <DipsAircraftPickerModal isOpen={true} onClose={vi.fn()} onSelect={vi.fn()} />
    );
    await screen.findByText("DUMMY0000001");

    expect(screen.queryByText(/件の機体情報を読み込めませんでした/)).not.toBeInTheDocument();
  });

  // ─── DIPS連携の解除 (req-007) ──────────────────────────────────────────────

  describe("別のアカウントでログインし直す (連携解除)", () => {
    it("test_modal_shows_unlink_trigger_button_below_aircraft_list", async () => {
      mockFetchDipsOwnedAircrafts.mockResolvedValue({ aircrafts: [activeAircraft], excludedCount: 0 });

      render(<DipsAircraftPickerModal isOpen={true} onClose={vi.fn()} onSelect={vi.fn()} />);
      await screen.findByText("DUMMY0000001");

      expect(
        screen.getByRole("button", { name: "別のアカウントでログインし直す" })
      ).toBeInTheDocument();
    });

    it("test_modal_does_not_call_unlink_api_when_trigger_is_clicked_without_confirmation", async () => {
      // 確認ダイアログを出さずに解除が実行されないこと
      mockFetchDipsOwnedAircrafts.mockResolvedValue({ aircrafts: [activeAircraft], excludedCount: 0 });
      const user = userEvent.setup();

      render(<DipsAircraftPickerModal isOpen={true} onClose={vi.fn()} onSelect={vi.fn()} />);
      await screen.findByText("DUMMY0000001");
      await user.click(screen.getByRole("button", { name: "別のアカウントでログインし直す" }));

      expect(mockUnlinkDipsAccount).not.toHaveBeenCalled();
    });

    it("test_modal_shows_confirmation_message_after_clicking_trigger", async () => {
      mockFetchDipsOwnedAircrafts.mockResolvedValue({ aircrafts: [activeAircraft], excludedCount: 0 });
      const user = userEvent.setup();

      render(<DipsAircraftPickerModal isOpen={true} onClose={vi.fn()} onSelect={vi.fn()} />);
      await screen.findByText("DUMMY0000001");
      await user.click(screen.getByRole("button", { name: "別のアカウントでログインし直す" }));

      expect(
        screen.getByText("連携を解除しますか？ 次回利用時に再度DIPSへのログインが必要になります。")
      ).toBeInTheDocument();
    });

    it("test_modal_cancel_button_does_not_call_unlink_api", async () => {
      // キャンセルすると解除されないこと
      mockFetchDipsOwnedAircrafts.mockResolvedValue({ aircrafts: [activeAircraft], excludedCount: 0 });
      const user = userEvent.setup();

      render(<DipsAircraftPickerModal isOpen={true} onClose={vi.fn()} onSelect={vi.fn()} />);
      await screen.findByText("DUMMY0000001");
      await user.click(screen.getByRole("button", { name: "別のアカウントでログインし直す" }));
      await user.click(screen.getByRole("button", { name: "キャンセル" }));

      expect(mockUnlinkDipsAccount).not.toHaveBeenCalled();
    });

    it("test_modal_cancel_button_hides_confirmation_and_restores_trigger_button", async () => {
      mockFetchDipsOwnedAircrafts.mockResolvedValue({ aircrafts: [activeAircraft], excludedCount: 0 });
      const user = userEvent.setup();

      render(<DipsAircraftPickerModal isOpen={true} onClose={vi.fn()} onSelect={vi.fn()} />);
      await screen.findByText("DUMMY0000001");
      await user.click(screen.getByRole("button", { name: "別のアカウントでログインし直す" }));
      await user.click(screen.getByRole("button", { name: "キャンセル" }));

      expect(screen.queryByText(/連携を解除しますか/)).not.toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: "別のアカウントでログインし直す" })
      ).toBeInTheDocument();
    });

    it("test_modal_confirm_button_calls_unlink_api_with_utm_realm", async () => {
      mockFetchDipsOwnedAircrafts.mockResolvedValue({ aircrafts: [activeAircraft], excludedCount: 0 });
      mockUnlinkDipsAccount.mockResolvedValue(undefined);
      const user = userEvent.setup();

      render(<DipsAircraftPickerModal isOpen={true} onClose={vi.fn()} onSelect={vi.fn()} />);
      await screen.findByText("DUMMY0000001");
      await user.click(screen.getByRole("button", { name: "別のアカウントでログインし直す" }));
      await user.click(screen.getByRole("button", { name: "解除する" }));

      expect(mockUnlinkDipsAccount).toHaveBeenCalledWith("utm");
    });

    it("test_modal_shows_login_prompt_after_successful_unlink_so_unlinked_state_is_visible", async () => {
      // 受け入れ条件6: 解除後の状態が画面から分かること (「未連携」であることが伝わる)
      mockFetchDipsOwnedAircrafts.mockResolvedValue({ aircrafts: [activeAircraft], excludedCount: 0 });
      mockUnlinkDipsAccount.mockResolvedValue(undefined);
      const user = userEvent.setup();

      render(<DipsAircraftPickerModal isOpen={true} onClose={vi.fn()} onSelect={vi.fn()} />);
      await screen.findByText("DUMMY0000001");
      await user.click(screen.getByRole("button", { name: "別のアカウントでログインし直す" }));
      await user.click(screen.getByRole("button", { name: "解除する" }));

      const link = await screen.findByRole("link", { name: "DIPSにログインする" });
      expect(link).toHaveAttribute("href", expect.stringContaining("realm=utm"));
    });

    it("test_modal_shows_error_message_when_unlink_api_fails", async () => {
      mockFetchDipsOwnedAircrafts.mockResolvedValue({ aircrafts: [activeAircraft], excludedCount: 0 });
      mockUnlinkDipsAccount.mockRejectedValue(new Error("DIPS連携の解除に失敗しました"));
      const user = userEvent.setup();

      render(<DipsAircraftPickerModal isOpen={true} onClose={vi.fn()} onSelect={vi.fn()} />);
      await screen.findByText("DUMMY0000001");
      await user.click(screen.getByRole("button", { name: "別のアカウントでログインし直す" }));
      await user.click(screen.getByRole("button", { name: "解除する" }));

      expect(await screen.findByText("DIPS連携の解除に失敗しました")).toBeInTheDocument();
    });

    it("test_modal_shows_trigger_button_again_after_unlink_failure_so_user_can_retry", async () => {
      mockFetchDipsOwnedAircrafts.mockResolvedValue({ aircrafts: [activeAircraft], excludedCount: 0 });
      mockUnlinkDipsAccount.mockRejectedValue(new Error("DIPS連携の解除に失敗しました"));
      const user = userEvent.setup();

      render(<DipsAircraftPickerModal isOpen={true} onClose={vi.fn()} onSelect={vi.fn()} />);
      await screen.findByText("DUMMY0000001");
      await user.click(screen.getByRole("button", { name: "別のアカウントでログインし直す" }));
      await user.click(screen.getByRole("button", { name: "解除する" }));
      await screen.findByText("DIPS連携の解除に失敗しました");

      expect(
        screen.getByRole("button", { name: "別のアカウントでログインし直す" })
      ).toBeInTheDocument();
    });
  });
});
