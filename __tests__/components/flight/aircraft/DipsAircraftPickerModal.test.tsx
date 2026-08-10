import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DipsAircraftPickerModal } from "@/components/flight/aircraft/DipsAircraftPickerModal";
import type { DipsOwnedAircraftDto } from "@/lib/api/dips";

const mockFetchDipsOwnedAircrafts = vi.hoisted(() => vi.fn());
vi.mock("@/lib/api/dips", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api/dips")>("@/lib/api/dips");
  return {
    ...actual,
    fetchDipsOwnedAircrafts: mockFetchDipsOwnedAircrafts,
  };
});

import { DipsAuthRequiredClientError } from "@/lib/api/dips";

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
  });

  it("test_modal_renders_aircraft_rows_from_api", async () => {
    mockFetchDipsOwnedAircrafts.mockResolvedValue([activeAircraft]);

    render(
      <DipsAircraftPickerModal isOpen={true} onClose={vi.fn()} onSelect={vi.fn()} />
    );

    expect(await screen.findByText("DUMMY0000001")).toBeInTheDocument();
  });

  it("test_modal_shows_empty_message_when_no_aircraft", async () => {
    mockFetchDipsOwnedAircrafts.mockResolvedValue([]);

    render(
      <DipsAircraftPickerModal isOpen={true} onClose={vi.fn()} onSelect={vi.fn()} />
    );

    expect(await screen.findByText("DIPSに登録された機体がありません")).toBeInTheDocument();
  });

  it("test_modal_calls_on_select_with_selected_aircraft", async () => {
    mockFetchDipsOwnedAircrafts.mockResolvedValue([activeAircraft]);
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

  it("test_modal_disables_selection_for_deregistered_aircraft", async () => {
    mockFetchDipsOwnedAircrafts.mockResolvedValue([deregisteredAircraft]);

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
    mockFetchDipsOwnedAircrafts.mockResolvedValue([]);

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
    mockFetchDipsOwnedAircrafts.mockResolvedValue([unknownStatusAircraft]);

    render(
      <DipsAircraftPickerModal isOpen={true} onClose={vi.fn()} onSelect={vi.fn()} />
    );

    expect(await screen.findByText("不明")).toBeInTheDocument();
  });
});
