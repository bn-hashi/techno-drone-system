import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AircraftForm } from "@/components/flight/aircraft/AircraftForm";
import type { AircraftDto } from "@/lib/api/aircraft";
import { updateAircraft } from "@/lib/api/aircraft";
import type { DipsOwnedAircraftDto } from "@/lib/api/dips";

const mockPush = vi.fn();
const mockBack = vi.fn();
const mockRefresh = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush, back: mockBack, refresh: mockRefresh }),
}));

vi.mock("@/lib/api/aircraft", () => ({
  createAircraft: vi.fn(),
  updateAircraft: vi.fn(),
}));

const editableAircraft: AircraftDto = {
  id: "aircraft-1",
  userId: "user-1",
  name: "テスト機体",
  manufacturer: "サンプル製造者",
  modelNumber: "サンプル型式",
  serialNumber: "SN00000001",
  weightGrams: 1000,
  maxFlightTimeMin: 20,
  registrationNumber: "DUMMY0000099",
  isActive: true,
  createdAt: "2026-01-01T00:00:00+09:00",
  updatedAt: "2026-01-01T00:00:00+09:00",
};

const mockFetchDipsOwnedAircrafts = vi.hoisted(() => vi.fn());
vi.mock("@/lib/api/dips", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api/dips")>("@/lib/api/dips");
  return {
    ...actual,
    fetchDipsOwnedAircrafts: mockFetchDipsOwnedAircrafts,
  };
});

const dipsAircraft: DipsOwnedAircraftDto = {
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

describe("AircraftForm", () => {
  beforeEach(() => {
    mockPush.mockReset();
    mockBack.mockReset();
    mockRefresh.mockReset();
    mockFetchDipsOwnedAircrafts.mockReset();
  });

  it("test_form_fills_registration_number_after_dips_selection", async () => {
    mockFetchDipsOwnedAircrafts.mockResolvedValue({ aircrafts: [dipsAircraft], excludedCount: 0 });
    const user = userEvent.setup();

    render(<AircraftForm />);
    await user.click(screen.getByRole("button", { name: "DIPSから取り込む" }));
    const row = await screen.findByText("DUMMY0000001");
    await user.click(row.closest("button") as HTMLButtonElement);

    expect(screen.getByLabelText("登録記号（国土交通省）")).toHaveValue("DUMMY0000001");
  });

  it("test_form_fills_manufacturer_after_dips_selection", async () => {
    mockFetchDipsOwnedAircrafts.mockResolvedValue({ aircrafts: [dipsAircraft], excludedCount: 0 });
    const user = userEvent.setup();

    render(<AircraftForm />);
    await user.click(screen.getByRole("button", { name: "DIPSから取り込む" }));
    const row = await screen.findByText("DUMMY0000001");
    await user.click(row.closest("button") as HTMLButtonElement);

    expect(screen.getByLabelText("製造メーカー *")).toHaveValue("サンプル製造者01");
  });

  it("test_form_overwrites_serial_number_after_dips_selection_in_edit_mode", async () => {
    // 回帰テスト (B1): 編集モードでは serialNumber を据え置いていたため、登録記号だけが
    // DIPS の値に変わり「DIPS 上に存在しない登録記号×製造番号の組み合わせ」が保存されて
    // しまうバグがあった。DIPS 取り込みでは serialNumber も DIPS の値で上書きする。
    mockFetchDipsOwnedAircrafts.mockResolvedValue({ aircrafts: [dipsAircraft], excludedCount: 0 });
    const user = userEvent.setup();

    render(<AircraftForm initialData={editableAircraft} />);
    await user.click(screen.getByRole("button", { name: "DIPSから取り込む" }));
    const row = await screen.findByText("DUMMY0000001");
    await user.click(row.closest("button") as HTMLButtonElement);

    expect(screen.getByLabelText("シリアル番号 *")).toHaveValue(dipsAircraft.serialNumber);
  });

  it("test_form_keeps_manual_input_available", async () => {
    const user = userEvent.setup();

    render(<AircraftForm />);
    const input = screen.getByLabelText("登録記号（国土交通省）");
    await user.type(input, "JU9999999999");

    expect(input).toHaveValue("JU9999999999");
    expect(mockFetchDipsOwnedAircrafts).not.toHaveBeenCalled();
  });

  it("test_form_closing_dips_modal_with_close_button_does_not_submit_the_form", async () => {
    // 回帰テスト: DipsAircraftPickerModal は AircraftForm の <form onSubmit> の内側にあり、
    // Modal はポータルを使わないため DOM 上も form の子孫になる。閉じるボタンに
    // type="button" が付いていないと、必須項目が initialData で埋まっている編集画面では
    // ✕ クリックが意図せずフォーム送信 (updateAircraft) を引き起こしてしまう。
    mockFetchDipsOwnedAircrafts.mockResolvedValue({ aircrafts: [], excludedCount: 0 });
    const user = userEvent.setup();

    render(<AircraftForm initialData={editableAircraft} />);
    await user.click(screen.getByRole("button", { name: "DIPSから取り込む" }));
    await screen.findByText("DIPSに登録された機体がありません");
    await user.click(screen.getByRole("button", { name: "閉じる" }));

    expect(updateAircraft).not.toHaveBeenCalled();
    expect(mockPush).not.toHaveBeenCalled();
  });
});
