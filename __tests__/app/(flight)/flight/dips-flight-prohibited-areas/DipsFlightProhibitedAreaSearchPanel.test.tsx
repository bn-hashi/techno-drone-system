import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { DipsFlightProhibitedAreaSearchPanel } from "@/app/(flight)/flight/dips-flight-prohibited-areas/DipsFlightProhibitedAreaSearchPanel";
import type { DipsFlightProhibitedAreaInfo } from "@/lib/api/dips";

const mockSearchDipsFlightProhibitedAreas = vi.hoisted(() => vi.fn());
vi.mock("@/lib/api/dips", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api/dips")>("@/lib/api/dips");
  return {
    ...actual,
    searchDipsFlightProhibitedAreas: mockSearchDipsFlightProhibitedAreas,
  };
});

import { DipsAuthRequiredClientError, AppSessionExpiredClientError } from "@/lib/api/dips";

const validArea: DipsFlightProhibitedAreaInfo = {
  areaId: "20221105_FISSikou0015",
  name: "東京国際空港 空港の区域",
  detail: "小型無人機等飛行禁止法に基づく飛行禁止空域",
  url: "https://www.mlit.go.jp/koku/koku_tk2_000023.html",
  areaTypeId: 5,
  startTime: "2022-10-01T09:00:00",
  finishTime: "9999-12-31T23:59:00",
  range: { type: "Polygon", center: [], radius: 0, coordinates: [] },
};

function renderWithQuery(ui: React.ReactElement) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

describe("DipsFlightProhibitedAreaSearchPanel", () => {
  beforeEach(() => {
    mockSearchDipsFlightProhibitedAreas.mockReset();
  });

  it("test_panel_does_not_search_on_initial_render", () => {
    // 外部 API (IP 制限・共用検証環境) をページ読み込み時に自動発火させない
    renderWithQuery(<DipsFlightProhibitedAreaSearchPanel />);

    expect(mockSearchDipsFlightProhibitedAreas).not.toHaveBeenCalled();
  });

  it("test_panel_searches_with_default_form_values_when_button_clicked", async () => {
    mockSearchDipsFlightProhibitedAreas.mockResolvedValue({ areas: [], excludedCount: 0 });
    const user = userEvent.setup();
    renderWithQuery(<DipsFlightProhibitedAreaSearchPanel />);

    await user.click(screen.getByRole("button", { name: "飛行禁止エリアを検索" }));

    expect(mockSearchDipsFlightProhibitedAreas).toHaveBeenCalledWith({
      centerLongitude: 139.7671,
      centerLatitude: 35.6812,
      radiusMeters: 1000,
      flightProhibitedAreaTypeIds: [5, 6],
    });
  });

  it("test_panel_shows_validation_error_and_does_not_call_api_when_area_type_unchecked", async () => {
    const user = userEvent.setup();
    renderWithQuery(<DipsFlightProhibitedAreaSearchPanel />);

    // 既定で選択済みの2種別をすべて外す
    await user.click(
      screen.getByRole("checkbox", { name: "小型無人機等飛行禁止法エリア(レッドゾーン)" })
    );
    await user.click(
      screen.getByRole("checkbox", { name: "小型無人機等飛行禁止法エリア(イエローゾーン)" })
    );
    await user.click(screen.getByRole("button", { name: "飛行禁止エリアを検索" }));

    expect(screen.getByRole("alert")).toHaveTextContent("飛行禁止エリア種別を1つ以上選択してください");
    expect(mockSearchDipsFlightProhibitedAreas).not.toHaveBeenCalled();
  });

  it("test_panel_displays_area_name_on_success", async () => {
    mockSearchDipsFlightProhibitedAreas.mockResolvedValue({ areas: [validArea], excludedCount: 0 });
    const user = userEvent.setup();
    renderWithQuery(<DipsFlightProhibitedAreaSearchPanel />);

    await user.click(screen.getByRole("button", { name: "飛行禁止エリアを検索" }));

    expect(await screen.findByText("東京国際空港 空港の区域")).toBeInTheDocument();
  });

  it("test_panel_renders_area_without_detail_and_url_without_crashing", async () => {
    const areaWithoutDetailAndUrl: DipsFlightProhibitedAreaInfo = {
      ...validArea,
      detail: null,
      url: null,
    };
    mockSearchDipsFlightProhibitedAreas.mockResolvedValue({
      areas: [areaWithoutDetailAndUrl],
      excludedCount: 0,
    });
    const user = userEvent.setup();
    renderWithQuery(<DipsFlightProhibitedAreaSearchPanel />);

    await user.click(screen.getByRole("button", { name: "飛行禁止エリアを検索" }));

    expect(await screen.findByText("東京国際空港 空港の区域")).toBeInTheDocument();
  });

  it("test_panel_does_not_render_detail_paragraph_when_area_detail_is_null", async () => {
    const areaWithoutDetailAndUrl: DipsFlightProhibitedAreaInfo = {
      ...validArea,
      detail: null,
      url: null,
    };
    mockSearchDipsFlightProhibitedAreas.mockResolvedValue({
      areas: [areaWithoutDetailAndUrl],
      excludedCount: 0,
    });
    const user = userEvent.setup();
    renderWithQuery(<DipsFlightProhibitedAreaSearchPanel />);

    await user.click(screen.getByRole("button", { name: "飛行禁止エリアを検索" }));
    await screen.findByText("東京国際空港 空港の区域");

    // detail が null のとき、`{area.detail && <p>...}` の詳細用 <p> 自体が DOM に
    // 存在しないことを検証する。detail が null の場合はテキスト内容も空になるため
    // queryByText(detail文言) では「<p> は残るが空文字で描画される」回帰を検出できない
    // (CodeRabbit 指摘の再現確認済み: ガードを外して `<p>{area.detail}</p>` に戻しても
    // queryByText ベースの検証は落ちなかった)。名前用・有効期限用・種別コード用の3つの
    // <p> は必ず描画されるため、detail 用 <p> が無ければ件数は3のままになる
    const listItem = screen.getByRole("listitem");
    expect(listItem.querySelectorAll("p")).toHaveLength(3);
  });

  it("test_panel_shows_zero_result_message_when_areas_empty", async () => {
    mockSearchDipsFlightProhibitedAreas.mockResolvedValue({ areas: [], excludedCount: 0 });
    const user = userEvent.setup();
    renderWithQuery(<DipsFlightProhibitedAreaSearchPanel />);

    await user.click(screen.getByRole("button", { name: "飛行禁止エリアを検索" }));

    expect(await screen.findByText("該当する飛行禁止エリアがありません")).toBeInTheDocument();
  });

  it("test_panel_shows_excluded_count_notice_when_greater_than_zero", async () => {
    mockSearchDipsFlightProhibitedAreas.mockResolvedValue({ areas: [validArea], excludedCount: 3 });
    const user = userEvent.setup();
    renderWithQuery(<DipsFlightProhibitedAreaSearchPanel />);

    await user.click(screen.getByRole("button", { name: "飛行禁止エリアを検索" }));

    expect(await screen.findByText(/3\s*件の飛行禁止エリア情報を読み込めませんでした/)).toBeInTheDocument();
  });

  it("test_panel_shows_dips_auth_prompt_on_auth_required_error", async () => {
    mockSearchDipsFlightProhibitedAreas.mockRejectedValue(new DipsAuthRequiredClientError("fpl"));
    const user = userEvent.setup();
    renderWithQuery(<DipsFlightProhibitedAreaSearchPanel />);

    await user.click(screen.getByRole("button", { name: "飛行禁止エリアを検索" }));

    expect(await screen.findByText("DIPSへのログインが必要です。")).toBeInTheDocument();
  });

  it("test_panel_shows_app_session_expired_prompt_on_session_expired_error", async () => {
    mockSearchDipsFlightProhibitedAreas.mockRejectedValue(new AppSessionExpiredClientError());
    const user = userEvent.setup();
    renderWithQuery(<DipsFlightProhibitedAreaSearchPanel />);

    await user.click(screen.getByRole("button", { name: "飛行禁止エリアを検索" }));

    expect(await screen.findByText(/ログインが必要です。再度ログインしてください/)).toBeInTheDocument();
  });

  // I3 回帰テスト (2026-09-06 レビュー): 502 等で失敗した後、入力を不正な値に変えて
  // 再検索すると、以前は古いエラーと新しいバリデーションエラーが同時に表示され
  // role="alert" が2つになっていた (読み上げも二重になる)。冒頭で mutation.reset() を
  // 呼ぶことで解消する
  it("test_panel_clears_previous_error_when_a_new_validation_error_occurs", async () => {
    mockSearchDipsFlightProhibitedAreas.mockRejectedValue(new Error("502エラー"));
    const user = userEvent.setup();
    renderWithQuery(<DipsFlightProhibitedAreaSearchPanel />);

    await user.click(screen.getByRole("button", { name: "飛行禁止エリアを検索" }));
    expect(await screen.findByText("502エラー")).toBeInTheDocument();

    // 種別を全て外してバリデーション失敗を誘発する
    await user.click(
      screen.getByRole("checkbox", { name: "小型無人機等飛行禁止法エリア(レッドゾーン)" })
    );
    await user.click(
      screen.getByRole("checkbox", { name: "小型無人機等飛行禁止法エリア(イエローゾーン)" })
    );
    await user.click(screen.getByRole("button", { name: "飛行禁止エリアを検索" }));

    expect(screen.queryByText("502エラー")).not.toBeInTheDocument();
    expect(screen.getAllByRole("alert")).toHaveLength(1);
  });

  // I3 回帰テスト: 成功して結果一覧が表示された後、不正な入力のまま再検索すると、
  // 以前は前回の結果一覧が残り続け「無効な条件のまま結果が残る」誤表示になっていた
  it("test_panel_clears_previous_results_when_a_new_validation_error_occurs", async () => {
    mockSearchDipsFlightProhibitedAreas.mockResolvedValue({ areas: [validArea], excludedCount: 0 });
    const user = userEvent.setup();
    renderWithQuery(<DipsFlightProhibitedAreaSearchPanel />);

    await user.click(screen.getByRole("button", { name: "飛行禁止エリアを検索" }));
    expect(await screen.findByText("東京国際空港 空港の区域")).toBeInTheDocument();

    await user.click(
      screen.getByRole("checkbox", { name: "小型無人機等飛行禁止法エリア(レッドゾーン)" })
    );
    await user.click(
      screen.getByRole("checkbox", { name: "小型無人機等飛行禁止法エリア(イエローゾーン)" })
    );
    await user.click(screen.getByRole("button", { name: "飛行禁止エリアを検索" }));

    expect(screen.queryByText("東京国際空港 空港の区域")).not.toBeInTheDocument();
  });

  it("test_panel_shows_generic_error_message_on_other_failures", async () => {
    mockSearchDipsFlightProhibitedAreas.mockRejectedValue(new Error("500エラー"));
    const user = userEvent.setup();
    renderWithQuery(<DipsFlightProhibitedAreaSearchPanel />);

    await user.click(screen.getByRole("button", { name: "飛行禁止エリアを検索" }));

    expect(await screen.findByText("500エラー")).toBeInTheDocument();
  });
});
