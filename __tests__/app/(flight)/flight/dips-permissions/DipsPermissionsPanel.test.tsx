import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { DipsPermissionsPanel } from "@/app/(flight)/flight/dips-permissions/DipsPermissionsPanel";
import type { DipsPermissionInfo, FetchDipsPermissionsResult } from "@/lib/api/dips";

const mockFetchDipsPermissions = vi.hoisted(() => vi.fn());
vi.mock("@/lib/api/dips", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api/dips")>("@/lib/api/dips");
  return {
    ...actual,
    fetchDipsPermissions: mockFetchDipsPermissions,
  };
});

import { DipsAuthRequiredClientError, AppSessionExpiredClientError } from "@/lib/api/dips";

const validPermission: DipsPermissionInfo = {
  permissionNumber: "東空運航TEST01",
  permissionNumber2: null,
  receptionNumber: "P000000001",
  permissionDate: "2026-01-01",
  permissionPeriodStart: "2026-01-01",
  permissionPeriodEnd: "2026-12-31",
  flightLocation: "テスト県テスト市",
  flightRoutes: [{ routeName: "テスト経路", routeLatlons: ["000000 0000000"] }],
  aboveDenselyInhabitedDistricts: true,
  moreThan150mAboveTheGround: false,
  aroundAirports: false,
  lessThan30m: false,
  overEventSites: false,
  nightOperation: false,
  beyondVisualLineOfSight: false,
  transportHazardousMaterials: false,
  dropObjects: false,
  uaInfos: [{ uaMaker: "テスト製造者", uaName: "テスト型式", regSymbol: "999999999999" }],
};

function renderWithQuery(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

describe("DipsPermissionsPanel", () => {
  beforeEach(() => {
    mockFetchDipsPermissions.mockReset();
  });

  it("test_panel_does_not_fetch_on_initial_render", () => {
    // 外部 API (IP 制限・共用検証環境) をページ読み込み時に自動発火させない (手動トリガー)
    renderWithQuery(<DipsPermissionsPanel />);

    expect(mockFetchDipsPermissions).not.toHaveBeenCalled();
  });

  it("test_panel_fetches_permissions_when_button_clicked", async () => {
    mockFetchDipsPermissions.mockResolvedValue({ permissions: [], excludedCount: 0 });
    const user = userEvent.setup();

    renderWithQuery(<DipsPermissionsPanel />);
    await user.click(screen.getByRole("button", { name: "許可・承認情報を取得" }));

    expect(mockFetchDipsPermissions).toHaveBeenCalledTimes(1);
  });

  it("test_panel_shows_loading_label_while_fetching", async () => {
    let resolvePending: (value: FetchDipsPermissionsResult) => void = () => {};
    mockFetchDipsPermissions.mockReturnValue(
      new Promise<FetchDipsPermissionsResult>((resolve) => {
        resolvePending = resolve;
      })
    );
    const user = userEvent.setup();

    renderWithQuery(<DipsPermissionsPanel />);
    await user.click(screen.getByRole("button", { name: "許可・承認情報を取得" }));

    expect(await screen.findByRole("button", { name: "取得中..." })).toBeInTheDocument();

    resolvePending({ permissions: [], excludedCount: 0 });
    expect(await screen.findByRole("button", { name: "許可・承認情報を取得" })).toBeInTheDocument();
  });

  it("test_panel_shows_permission_reception_number_on_success", async () => {
    mockFetchDipsPermissions.mockResolvedValue({
      permissions: [validPermission],
      excludedCount: 0,
    });
    const user = userEvent.setup();

    renderWithQuery(<DipsPermissionsPanel />);
    await user.click(screen.getByRole("button", { name: "許可・承認情報を取得" }));

    expect(await screen.findByText(/P000000001/)).toBeInTheDocument();
  });

  it("test_panel_shows_active_flight_condition_flag_label", async () => {
    // aboveDenselyInhabitedDistricts: true のときだけラベルが表示され、
    // false のフラグ (moreThan150mAboveTheGround 等) は表示されないことを確認する
    mockFetchDipsPermissions.mockResolvedValue({
      permissions: [validPermission],
      excludedCount: 0,
    });
    const user = userEvent.setup();

    renderWithQuery(<DipsPermissionsPanel />);
    await user.click(screen.getByRole("button", { name: "許可・承認情報を取得" }));

    expect(await screen.findByText(/人口集中地区\(DID\)上空/)).toBeInTheDocument();
  });

  it("test_panel_does_not_show_inactive_flight_condition_flag_label", async () => {
    mockFetchDipsPermissions.mockResolvedValue({
      permissions: [validPermission],
      excludedCount: 0,
    });
    const user = userEvent.setup();

    renderWithQuery(<DipsPermissionsPanel />);
    await user.click(screen.getByRole("button", { name: "許可・承認情報を取得" }));

    await screen.findByText(/P000000001/);
    expect(screen.queryByText(/夜間飛行/)).not.toBeInTheDocument();
  });

  it("test_panel_shows_empty_message_when_no_permissions", async () => {
    mockFetchDipsPermissions.mockResolvedValue({ permissions: [], excludedCount: 0 });
    const user = userEvent.setup();

    renderWithQuery(<DipsPermissionsPanel />);
    await user.click(screen.getByRole("button", { name: "許可・承認情報を取得" }));

    expect(await screen.findByText("許可・承認情報がありません")).toBeInTheDocument();
  });

  it("test_panel_shows_excluded_count_notice_when_positive", async () => {
    mockFetchDipsPermissions.mockResolvedValue({
      permissions: [validPermission],
      excludedCount: 3,
    });
    const user = userEvent.setup();

    renderWithQuery(<DipsPermissionsPanel />);
    await user.click(screen.getByRole("button", { name: "許可・承認情報を取得" }));

    expect(await screen.findByText(/3件の許可・承認情報を読み込めませんでした/)).toBeInTheDocument();
  });

  it("test_panel_shows_dips_login_link_with_req_realm_when_auth_required", async () => {
    mockFetchDipsPermissions.mockRejectedValue(new DipsAuthRequiredClientError("req"));
    const user = userEvent.setup();

    renderWithQuery(<DipsPermissionsPanel />);
    await user.click(screen.getByRole("button", { name: "許可・承認情報を取得" }));

    const link = await screen.findByRole("link", { name: "DIPSにログインする" });
    expect(link).toHaveAttribute("href", expect.stringContaining("realm=req"));
  });

  it("test_panel_shows_app_login_link_when_app_session_expired", async () => {
    mockFetchDipsPermissions.mockRejectedValue(new AppSessionExpiredClientError());
    const user = userEvent.setup();

    renderWithQuery(<DipsPermissionsPanel />);
    await user.click(screen.getByRole("button", { name: "許可・承認情報を取得" }));

    const link = await screen.findByRole("link", { name: "ログイン画面へ" });
    expect(link).toHaveAttribute("href", "/login");
  });

  it("test_panel_shows_generic_error_message_on_other_failures", async () => {
    mockFetchDipsPermissions.mockRejectedValue(new Error("DIPS連携でエラーが発生しました"));
    const user = userEvent.setup();

    renderWithQuery(<DipsPermissionsPanel />);
    await user.click(screen.getByRole("button", { name: "許可・承認情報を取得" }));

    expect(await screen.findByText("DIPS連携でエラーが発生しました")).toBeInTheDocument();
  });

  it("test_panel_refetches_on_second_click_after_first_request", async () => {
    mockFetchDipsPermissions.mockResolvedValue({ permissions: [], excludedCount: 0 });
    const user = userEvent.setup();

    renderWithQuery(<DipsPermissionsPanel />);
    const button = screen.getByRole("button", { name: "許可・承認情報を取得" });
    await user.click(button);
    await screen.findByText("許可・承認情報がありません");
    await user.click(screen.getByRole("button", { name: "許可・承認情報を取得" }));

    expect(mockFetchDipsPermissions).toHaveBeenCalledTimes(2);
  });
});
