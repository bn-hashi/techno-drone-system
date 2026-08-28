import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider, onlineManager } from "@tanstack/react-query";
import { DipsPermissionsPanel } from "@/app/(flight)/flight/dips-permissions/DipsPermissionsPanel";
import type { DipsPermissionInfo, FetchDipsPermissionsResult } from "@/lib/api/dips";

// F6 差し戻し: ?dips=... (DIPS 認可コールバック) の処理を検証するため next/navigation を
// モックする (DipsNotifyButton.test.tsx と同じ方針)。
const mockReplace = vi.fn();
let mockSearchParamsValue = "";
// 実際の useSearchParams はレンダー間で同一の参照を返す。テストの mock も同様にしないと
// 依存配列の参照比較が毎回変化し、effect が無限ループする
let mockSearchParamsInstance = new URLSearchParams(mockSearchParamsValue);
const mockRouterInstance = { replace: mockReplace };
vi.mock("next/navigation", () => ({
  useRouter: () => mockRouterInstance,
  usePathname: () => "/flight/dips-permissions",
  useSearchParams: () => mockSearchParamsInstance,
}));

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
    mockReplace.mockReset();
    mockSearchParamsValue = "";
    mockSearchParamsInstance = new URLSearchParams(mockSearchParamsValue);
  });

  afterEach(() => {
    // onlineManager はモジュール単位のシングルトンのため、reconnect のテストで
    // false にした場合は他のテストへ影響しないよう必ず online に戻す
    onlineManager.setOnline(true);
  });

  /** 各テストで dips クエリを設定する際は、参照を安定させたまま値を更新する */
  function setDipsQuery(value: string): void {
    mockSearchParamsValue = value;
    mockSearchParamsInstance = new URLSearchParams(value);
  }

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

  // ─── F7 差し戻し: 除外件数の注記に不完全性の警告を添える ───────────────────────

  it("test_panel_excluded_count_notice_warns_the_list_may_be_incomplete", async () => {
    // DipsAircraftPickerModal.tsx の文言水準 (一覧が不完全な可能性・問い合わせ導線) に揃える
    mockFetchDipsPermissions.mockResolvedValue({
      permissions: [validPermission],
      excludedCount: 3,
    });
    const user = userEvent.setup();

    renderWithQuery(<DipsPermissionsPanel />);
    await user.click(screen.getByRole("button", { name: "許可・承認情報を取得" }));

    expect(
      await screen.findByText(/表示されている許可・承認情報以外にも/)
    ).toBeInTheDocument();
    expect(screen.getByText(/サポートへお問い合わせください/)).toBeInTheDocument();
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

  // ─── F2 差し戻し: 読み込み中に古いキャッシュを描画しない ───────────────────────

  it("test_panel_hides_previous_data_during_refetch_after_remount", async () => {
    // 実機検証で判明した不具合の再現: 再マウント後にクリックすると、refetch() が
    // 返るまでの間、別マウント時に取得した古いデータがそのまま描画されていた
    // (isFetching を見ずに query.data の有無だけで表示判定していたため)。
    // A1 のテストと同じく staleTime 60秒 (本番相当) の QueryClient を使い、
    // キャッシュがフレッシュなまま残っている状況を再現する。
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, staleTime: 60 * 1000 } },
    });
    mockFetchDipsPermissions.mockResolvedValueOnce({
      permissions: [validPermission],
      excludedCount: 0,
    });
    const user = userEvent.setup();

    const { unmount } = render(
      <QueryClientProvider client={queryClient}>
        <DipsPermissionsPanel />
      </QueryClientProvider>
    );
    await user.click(screen.getByRole("button", { name: "許可・承認情報を取得" }));
    await screen.findByText(/P000000001/);
    unmount();

    let resolveSecondFetch: (value: FetchDipsPermissionsResult) => void = () => {};
    mockFetchDipsPermissions.mockReturnValue(
      new Promise<FetchDipsPermissionsResult>((resolve) => {
        resolveSecondFetch = resolve;
      })
    );

    render(
      <QueryClientProvider client={queryClient}>
        <DipsPermissionsPanel />
      </QueryClientProvider>
    );
    await user.click(screen.getByRole("button", { name: "許可・承認情報を取得" }));

    // refetch() がまだ返っていない間は、前回 (別マウント) の古いデータを表示しない
    expect(screen.queryByText(/P000000001/)).not.toBeInTheDocument();

    resolveSecondFetch({ permissions: [validPermission], excludedCount: 0 });
    expect(await screen.findByText(/P000000001/)).toBeInTheDocument();
  });

  // ─── F3 差し戻し: オフライン時の挙動 (無反応ボタンにしない・無操作で叩かない) ──────

  it("test_panel_still_attempts_fetch_when_clicked_while_offline", async () => {
    // 旧実装 (networkMode 既定 = "online") では、オフライン判定中のクリックはクエリが
    // paused になり queryFn 自体が呼ばれず、isFetching も false に戻るため
    // 「クリックしても何も起きない (無反応ボタン)」ように見えていた。networkMode: "always"
    // は常に queryFn を呼ぶため、オフラインなら通常のネットワークエラー表示に倒れる
    // (無反応のまま何も起きない状態にはしない)。
    mockFetchDipsPermissions.mockResolvedValue({ permissions: [], excludedCount: 0 });
    const user = userEvent.setup();

    onlineManager.setOnline(false);
    renderWithQuery(<DipsPermissionsPanel />);
    await user.click(screen.getByRole("button", { name: "許可・承認情報を取得" }));

    expect(mockFetchDipsPermissions).toHaveBeenCalledTimes(1);
  });

  it("test_panel_does_not_auto_call_dips_when_reconnecting_after_a_click_made_while_offline", async () => {
    // 旧実装では、オフライン中のクリックで enqueue された paused フェッチが接続復帰時に
    // 自動で再開していた。これは「クリックしていないのに DIPS を叩く」(A2 で防いだはずの
    // 経路) の再発だった。networkMode: "always" はそもそもクエリを paused にしないため、
    // 再接続時に何かが自動的に再開することもないことを確認する。
    mockFetchDipsPermissions.mockRejectedValue(
      new Error("DIPS許可・承認情報の取得に失敗しました。ネットワーク接続を確認してください")
    );
    const user = userEvent.setup();

    onlineManager.setOnline(false);
    renderWithQuery(<DipsPermissionsPanel />);
    await user.click(screen.getByRole("button", { name: "許可・承認情報を取得" }));
    await screen.findByText(/ネットワーク接続を確認してください/);

    mockFetchDipsPermissions.mockClear();
    await act(async () => {
      onlineManager.setOnline(true);
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(mockFetchDipsPermissions).not.toHaveBeenCalled();
  });

  // ─── F6 差し戻し: ?dips=error / ?dips=state_error を扱う ───────────────────────

  it("test_panel_shows_error_banner_when_returned_from_oauth_with_dips_error", () => {
    // 「未連携 (まだボタンを押していない)」状態と混同すると、runbook の切り分け表にある
    // 「無限ログインループ」と見分けがつかなくなるため、明示的なバナーで区別する
    setDipsQuery("dips=error");

    renderWithQuery(<DipsPermissionsPanel />);

    expect(screen.getByRole("alert")).toHaveTextContent("DIPS連携に失敗しました");
  });

  it("test_panel_shows_state_error_banner_message_when_dips_state_error", () => {
    setDipsQuery("dips=state_error");

    renderWithQuery(<DipsPermissionsPanel />);

    expect(screen.getByRole("alert")).toHaveTextContent("DIPS連携の検証に失敗しました");
  });

  it("test_panel_shows_success_banner_when_dips_linked", () => {
    setDipsQuery("dips=linked");

    renderWithQuery(<DipsPermissionsPanel />);

    expect(screen.getByRole("status")).toHaveTextContent("DIPS連携が完了しました");
  });

  it("test_panel_removes_dips_query_param_after_processing_oauth_return", () => {
    setDipsQuery("dips=linked");

    renderWithQuery(<DipsPermissionsPanel />);

    expect(mockReplace).toHaveBeenCalledWith("/flight/dips-permissions", { scroll: false });
  });

  it("test_panel_does_not_show_oauth_banner_when_dips_query_param_is_absent", () => {
    // 「未連携でまだボタンを押していない」通常の初期表示ではバナーを出さない
    renderWithQuery(<DipsPermissionsPanel />);

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  // ─── F9 差し戻し: role="alert" に aria-live="polite" を併記しない ───────────────

  it("test_panel_generic_error_alert_does_not_have_conflicting_aria_live_polite", async () => {
    // role="alert" は本来 assertive (即時) 通知を意味する。aria-live="polite" を
    // 併記すると polite に上書きされ、重大なエラーの優先度が下がってしまう
    mockFetchDipsPermissions.mockRejectedValue(new Error("DIPS連携でエラーが発生しました"));
    const user = userEvent.setup();

    renderWithQuery(<DipsPermissionsPanel />);
    await user.click(screen.getByRole("button", { name: "許可・承認情報を取得" }));

    const alert = await screen.findByRole("alert");
    expect(alert).not.toHaveAttribute("aria-live", "polite");
  });
});
