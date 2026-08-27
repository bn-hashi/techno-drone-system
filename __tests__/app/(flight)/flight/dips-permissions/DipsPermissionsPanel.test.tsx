import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider, onlineManager } from "@tanstack/react-query";
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

  afterEach(() => {
    // onlineManager はモジュール単位のシングルトンのため、reconnect のテストで
    // false にした場合は他のテストへ影響しないよう必ず online に戻す
    onlineManager.setOnline(true);
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

  // ─── A1 差し戻し: 再マウント後の1回目のクリックで fetch が発生しない ─────────────

  it("test_panel_fetches_again_on_first_click_after_remount_even_when_cache_is_fresh", async () => {
    // 実機検証 (2026-08-19) の再現: QueryProvider.tsx の staleTime (60秒) 相当の
    // フレッシュなキャッシュが残っていると、再マウント後の1回目のクリックで
    // enabled: hasRequested のフリップだけに頼る実装では fetch が発生しなかった。
    // 「ボタンを1回押す = DIPS を1回呼ぶ」を守るため、クリックは常に refetch() を
    // 明示的に呼ぶ実装にした (staleTime の値に関わらず動作することの証明として、
    // 本番と同じ 60秒を明示的に設定する)
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, staleTime: 60 * 1000 } },
    });
    mockFetchDipsPermissions.mockResolvedValue({ permissions: [], excludedCount: 0 });
    const user = userEvent.setup();

    const { unmount } = render(
      <QueryClientProvider client={queryClient}>
        <DipsPermissionsPanel />
      </QueryClientProvider>
    );
    await user.click(screen.getByRole("button", { name: "許可・承認情報を取得" }));
    await screen.findByText("許可・承認情報がありません");
    unmount();

    render(
      <QueryClientProvider client={queryClient}>
        <DipsPermissionsPanel />
      </QueryClientProvider>
    );
    await user.click(screen.getByRole("button", { name: "許可・承認情報を取得" }));

    expect(mockFetchDipsPermissions).toHaveBeenCalledTimes(2);
  });

  // ─── A2 差し戻し: クリックしていないのに再接続だけで呼ばれる ────────────────────

  it("test_panel_does_not_refetch_on_network_reconnect", async () => {
    // 実機検証 (2026-08-19) の再現: ネットワーク再接続だけで fetch 回数が 1→2 に増えた。
    // IP 制限された検証環境を無操作で叩いてしまうため、refetchOnReconnect を明示的に
    // false にする
    mockFetchDipsPermissions.mockResolvedValue({ permissions: [], excludedCount: 0 });
    const user = userEvent.setup();

    renderWithQuery(<DipsPermissionsPanel />);
    await user.click(screen.getByRole("button", { name: "許可・承認情報を取得" }));
    await screen.findByText("許可・承認情報がありません");

    // setOnline の呼び出し自体は同期だが、TanStack Query 内部の通知バッチが
    // マイクロタスク経由の場合に備え、判定前に一巡フラッシュする
    await act(async () => {
      onlineManager.setOnline(false);
      onlineManager.setOnline(true);
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(mockFetchDipsPermissions).toHaveBeenCalledTimes(1);
  });

  // ─── A4 差し戻し: 失敗後も古いデータが残る ─────────────────────────────────────

  it("test_panel_hides_stale_permission_data_when_a_later_request_fails", async () => {
    // 実機検証 (2026-08-19) の再現: 401 の直後に「DIPSへのログインが必要です」と
    // 古い許可カードが同時に表示された。query.isError のときはデータブロックを
    // 表示しないことで、古いデータが誤って「まだ有効」に見えるのを防ぐ
    mockFetchDipsPermissions.mockResolvedValueOnce({
      permissions: [validPermission],
      excludedCount: 0,
    });
    const user = userEvent.setup();

    renderWithQuery(<DipsPermissionsPanel />);
    await user.click(screen.getByRole("button", { name: "許可・承認情報を取得" }));
    await screen.findByText(/P000000001/);

    mockFetchDipsPermissions.mockRejectedValueOnce(new DipsAuthRequiredClientError("req"));
    await user.click(screen.getByRole("button", { name: "許可・承認情報を取得" }));

    await screen.findByRole("link", { name: "DIPSにログインする" });
    expect(screen.queryByText(/P000000001/)).not.toBeInTheDocument();
  });

  // ─── D4(a) 差し戻し: 許可期間が ISO 形式のまま生表示される ──────────────────────

  it("test_panel_formats_iso_permission_period_end_instead_of_showing_raw_string", async () => {
    const isoPeriodPermission: DipsPermissionInfo = {
      ...validPermission,
      permissionPeriodEnd: "2027-03-31T00:00:00+09:00",
    };
    mockFetchDipsPermissions.mockResolvedValue({
      permissions: [isoPeriodPermission],
      excludedCount: 0,
    });
    const user = userEvent.setup();

    renderWithQuery(<DipsPermissionsPanel />);
    await user.click(screen.getByRole("button", { name: "許可・承認情報を取得" }));

    const formatted = new Date("2027-03-31T00:00:00+09:00").toLocaleDateString("ja-JP", {
      timeZone: "Asia/Tokyo",
    });
    const escapedForRegex = formatted.replace(/\//g, "\\/");
    expect(await screen.findByText(new RegExp(escapedForRegex))).toBeInTheDocument();
    expect(screen.queryByText(/2027-03-31T00:00:00\+09:00/)).not.toBeInTheDocument();
  });
});
