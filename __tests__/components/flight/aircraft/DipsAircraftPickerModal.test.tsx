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
  registrationCode: "JU1219043018",
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
  registrationCode: "JU1219043097",
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

    expect(await screen.findByText("JU1219043018")).toBeInTheDocument();
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
    const row = await screen.findByText("JU1219043018");
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
    const row = await screen.findByText("JU1219043097");

    expect(row.closest("button")).toBeDisabled();
  });

  it("test_modal_shows_error_message_on_api_failure", async () => {
    mockFetchDipsOwnedAircrafts.mockRejectedValue(new Error("DIPS機体情報の取得に失敗しました"));

    render(
      <DipsAircraftPickerModal isOpen={true} onClose={vi.fn()} onSelect={vi.fn()} />
    );

    expect(await screen.findByText("DIPS機体情報の取得に失敗しました")).toBeInTheDocument();
  });
});
