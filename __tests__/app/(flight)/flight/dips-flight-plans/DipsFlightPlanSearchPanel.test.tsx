import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { DipsFlightPlanSearchPanel } from "@/app/(flight)/flight/dips-flight-plans/DipsFlightPlanSearchPanel";
import type { DipsFlightPlanInfo } from "@/lib/api/dips";

const mockSearchDipsFlightPlans = vi.hoisted(() => vi.fn());
vi.mock("@/lib/api/dips", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api/dips")>("@/lib/api/dips");
  return {
    ...actual,
    searchDipsFlightPlans: mockSearchDipsFlightPlans,
  };
});

import { DipsAuthRequiredClientError, AppSessionExpiredClientError } from "@/lib/api/dips";

const validFlightPlan: DipsFlightPlanInfo = {
  flightPlanId: "PLAN-1",
  name: "訓練飛行",
  flightPurpose: [15],
  flightAirspace: [1],
  flightType: [1],
  assistantsNumber: 0,
  departurePoint: "泉岳寺",
  destinationPoint: "京急泉岳寺駅",
  startTime: "20261125 1130",
  finishTime: "20261125 1230",
  plannedMaxTime: 120,
  plannedFlightTime: 60,
  flightSpeed: 100,
  flightAltitude: 120,
  flyRoute: { type: "Circle", center: [139.4677, 35.6476], radius: 150, coordinates: [] },
  riskMitigationOnsiteControl: "1",
  riskMitigationOnsiteControlL3: "0",
  riskMitigationOnsiteControlL35: "0",
  riskMitigationOnsiteControl2: "0",
  exceptionalConditionsMooring: "0",
  insuranceInformation: null,
  otherInformation: null,
  pilotInfo: null,
  aircraftInfo: null,
  flightPermitApplicationInfo: null,
};

function renderWithQuery(ui: React.ReactElement) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

describe("DipsFlightPlanSearchPanel", () => {
  beforeEach(() => {
    mockSearchDipsFlightPlans.mockReset();
  });

  it("test_panel_does_not_search_on_initial_render", () => {
    renderWithQuery(<DipsFlightPlanSearchPanel />);

    expect(mockSearchDipsFlightPlans).not.toHaveBeenCalled();
  });

  it("test_panel_searches_with_default_form_values_when_button_clicked", async () => {
    mockSearchDipsFlightPlans.mockResolvedValue({ flightPlans: [], excludedCount: 0 });
    const user = userEvent.setup();
    renderWithQuery(<DipsFlightPlanSearchPanel />);

    await user.click(screen.getByRole("button", { name: "飛行計画情報を検索" }));

    expect(mockSearchDipsFlightPlans).toHaveBeenCalledWith({
      centerLongitude: 139.7671,
      centerLatitude: 35.6812,
      radiusMeters: 1000,
      onlyMine: false,
    });
  });

  it("test_panel_sends_only_mine_true_when_checkbox_checked", async () => {
    mockSearchDipsFlightPlans.mockResolvedValue({ flightPlans: [], excludedCount: 0 });
    const user = userEvent.setup();
    renderWithQuery(<DipsFlightPlanSearchPanel />);

    await user.click(screen.getByRole("checkbox", { name: "自分の飛行計画のみ検索する" }));
    await user.click(screen.getByRole("button", { name: "飛行計画情報を検索" }));

    expect(mockSearchDipsFlightPlans).toHaveBeenCalledWith(
      expect.objectContaining({ onlyMine: true })
    );
  });

  it("test_panel_shows_validation_error_and_does_not_call_api_when_radius_invalid", async () => {
    const user = userEvent.setup();
    renderWithQuery(<DipsFlightPlanSearchPanel />);

    await user.clear(screen.getByLabelText("半径 (m)"));
    await user.type(screen.getByLabelText("半径 (m)"), "0");
    await user.click(screen.getByRole("button", { name: "飛行計画情報を検索" }));

    expect(screen.getByRole("alert")).toHaveTextContent(
      "経度・緯度・半径 (1以上) を正しく入力してください"
    );
    expect(mockSearchDipsFlightPlans).not.toHaveBeenCalled();
  });

  it("test_panel_displays_flight_plan_name_on_success", async () => {
    mockSearchDipsFlightPlans.mockResolvedValue({ flightPlans: [validFlightPlan], excludedCount: 0 });
    const user = userEvent.setup();
    renderWithQuery(<DipsFlightPlanSearchPanel />);

    await user.click(screen.getByRole("button", { name: "飛行計画情報を検索" }));

    expect(await screen.findByText("訓練飛行")).toBeInTheDocument();
  });

  it("test_panel_shows_zero_result_message_when_flight_plans_empty", async () => {
    mockSearchDipsFlightPlans.mockResolvedValue({ flightPlans: [], excludedCount: 0 });
    const user = userEvent.setup();
    renderWithQuery(<DipsFlightPlanSearchPanel />);

    await user.click(screen.getByRole("button", { name: "飛行計画情報を検索" }));

    expect(await screen.findByText("該当する飛行計画がありません")).toBeInTheDocument();
  });

  it("test_panel_shows_dips_auth_prompt_on_auth_required_error", async () => {
    mockSearchDipsFlightPlans.mockRejectedValue(new DipsAuthRequiredClientError("fpl"));
    const user = userEvent.setup();
    renderWithQuery(<DipsFlightPlanSearchPanel />);

    await user.click(screen.getByRole("button", { name: "飛行計画情報を検索" }));

    expect(await screen.findByText("DIPSへのログインが必要です。")).toBeInTheDocument();
  });

  it("test_panel_shows_app_session_expired_prompt_on_session_expired_error", async () => {
    mockSearchDipsFlightPlans.mockRejectedValue(new AppSessionExpiredClientError());
    const user = userEvent.setup();
    renderWithQuery(<DipsFlightPlanSearchPanel />);

    await user.click(screen.getByRole("button", { name: "飛行計画情報を検索" }));

    expect(await screen.findByText(/ログインが必要です。再度ログインしてください/)).toBeInTheDocument();
  });

  it("test_panel_shows_generic_error_message_on_other_failures", async () => {
    mockSearchDipsFlightPlans.mockRejectedValue(new Error("500エラー"));
    const user = userEvent.setup();
    renderWithQuery(<DipsFlightPlanSearchPanel />);

    await user.click(screen.getByRole("button", { name: "飛行計画情報を検索" }));

    expect(await screen.findByText("500エラー")).toBeInTheDocument();
  });
});
