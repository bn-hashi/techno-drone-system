import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AircraftForm } from "@/components/flight/aircraft/AircraftForm";
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
    mockFetchDipsOwnedAircrafts.mockResolvedValue([dipsAircraft]);
    const user = userEvent.setup();

    render(<AircraftForm />);
    await user.click(screen.getByRole("button", { name: "DIPSから取り込む" }));
    const row = await screen.findByText("DUMMY0000001");
    await user.click(row.closest("button") as HTMLButtonElement);

    expect(screen.getByLabelText("登録記号（国土交通省）")).toHaveValue("DUMMY0000001");
    expect(screen.getByLabelText("製造メーカー *")).toHaveValue("サンプル製造者01");
  });

  it("test_form_keeps_manual_input_available", async () => {
    const user = userEvent.setup();

    render(<AircraftForm />);
    const input = screen.getByLabelText("登録記号（国土交通省）");
    await user.type(input, "JU9999999999");

    expect(input).toHaveValue("JU9999999999");
    expect(mockFetchDipsOwnedAircrafts).not.toHaveBeenCalled();
  });
});
