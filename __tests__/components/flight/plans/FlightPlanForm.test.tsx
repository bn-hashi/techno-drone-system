import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { FlightPlanForm } from "@/components/flight/plans/FlightPlanForm";
import type { FlightPlanDto } from "@/lib/api/flightPlan";

// router.push / router.refresh を検証するため useRouter をモック
const mockPush = vi.fn();
const mockRefresh = vi.fn();
const mockBack = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush, refresh: mockRefresh, back: mockBack }),
}));

// vi.mock はファイル先頭にホイストされるため vi.hoisted で変数を事前に宣言する
const mockCreateFlightPlan = vi.hoisted(() => vi.fn());
const mockUpdateFlightPlan = vi.hoisted(() => vi.fn());
vi.mock("@/lib/api/flightPlan", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api/flightPlan")>(
    "@/lib/api/flightPlan"
  );
  return {
    ...actual,
    createFlightPlan: mockCreateFlightPlan,
    updateFlightPlan: mockUpdateFlightPlan,
  };
});

const aircrafts = [
  { id: "aircraft-1", name: "Phantom", manufacturer: "DJI" },
  { id: "aircraft-2", name: "Mavic", manufacturer: "DJI" },
];

const initialData: FlightPlanDto = {
  id: "plan-1",
  userId: "user-1",
  aircraftId: "aircraft-1",
  title: "既存タイトル",
  location: "東京都",
  plannedAt: "2026-08-01T01:00:00.000Z",
  durationMin: 30,
  purpose: "既存の目的",
  status: "DRAFT",
  createdAt: "2026-07-01T00:00:00.000Z",
  updatedAt: "2026-07-01T00:00:00.000Z",
};

describe("FlightPlanForm edit mode", () => {
  beforeEach(() => {
    mockPush.mockReset();
    mockRefresh.mockReset();
    mockBack.mockReset();
    mockCreateFlightPlan.mockReset();
    mockUpdateFlightPlan.mockReset();
  });

  it("test_FlightPlanForm_edit_mode_initializes_title_from_initialData", () => {
    render(<FlightPlanForm aircrafts={aircrafts} initialData={initialData} />);

    expect(screen.getByLabelText("タイトル")).toHaveValue("既存タイトル");
  });

  it("test_FlightPlanForm_edit_mode_initializes_location_from_initialData", () => {
    render(<FlightPlanForm aircrafts={aircrafts} initialData={initialData} />);

    expect(screen.getByLabelText("飛行場所")).toHaveValue("東京都");
  });

  it("test_FlightPlanForm_edit_mode_initializes_purpose_from_initialData", () => {
    render(<FlightPlanForm aircrafts={aircrafts} initialData={initialData} />);

    expect(screen.getByLabelText("飛行目的")).toHaveValue("既存の目的");
  });

  it("test_FlightPlanForm_edit_mode_disables_aircraft_select", () => {
    render(<FlightPlanForm aircrafts={aircrafts} initialData={initialData} />);

    expect(screen.getByLabelText("使用機体")).toBeDisabled();
  });

  it("test_FlightPlanForm_edit_mode_shows_update_button_label", () => {
    render(<FlightPlanForm aircrafts={aircrafts} initialData={initialData} />);

    expect(screen.getByRole("button", { name: "更新する" })).toBeInTheDocument();
  });

  it("test_FlightPlanForm_edit_mode_submit_calls_updateFlightPlan_with_plan_id", async () => {
    mockUpdateFlightPlan.mockResolvedValue(initialData);

    render(<FlightPlanForm aircrafts={aircrafts} initialData={initialData} />);
    fireEvent.click(screen.getByRole("button", { name: "更新する" }));

    await waitFor(() => {
      expect(mockUpdateFlightPlan).toHaveBeenCalledWith("plan-1", {
        title: "既存タイトル",
        location: "東京都",
        plannedAt: expect.any(String),
        durationMin: 30,
        purpose: "既存の目的",
      });
    });
  });

  it("test_FlightPlanForm_edit_mode_submit_does_not_call_createFlightPlan", async () => {
    mockUpdateFlightPlan.mockResolvedValue(initialData);

    render(<FlightPlanForm aircrafts={aircrafts} initialData={initialData} />);
    fireEvent.click(screen.getByRole("button", { name: "更新する" }));

    await waitFor(() => {
      expect(mockCreateFlightPlan).not.toHaveBeenCalled();
    });
  });

  it("test_FlightPlanForm_edit_mode_submit_success_navigates_to_detail_page", async () => {
    mockUpdateFlightPlan.mockResolvedValue(initialData);

    render(<FlightPlanForm aircrafts={aircrafts} initialData={initialData} />);
    fireEvent.click(screen.getByRole("button", { name: "更新する" }));

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith("/flight/plans/plan-1");
    });
  });

  it("test_FlightPlanForm_edit_mode_submit_error_shows_error_message", async () => {
    mockUpdateFlightPlan.mockRejectedValue(new Error("飛行完了済みの計画は編集できません"));

    render(<FlightPlanForm aircrafts={aircrafts} initialData={initialData} />);
    fireEvent.click(screen.getByRole("button", { name: "更新する" }));

    await waitFor(() => {
      expect(screen.getByText("飛行完了済みの計画は編集できません")).toBeInTheDocument();
    });
  });

  it("test_FlightPlanForm_create_mode_shows_create_button_label", () => {
    render(<FlightPlanForm aircrafts={aircrafts} />);

    expect(screen.getByRole("button", { name: "飛行計画を作成" })).toBeInTheDocument();
  });
});
