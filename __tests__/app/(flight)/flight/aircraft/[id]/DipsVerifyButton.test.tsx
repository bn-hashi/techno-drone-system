import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DipsVerifyButton } from "@/app/(flight)/flight/aircraft/[id]/DipsVerifyButton";
import type { DipsOwnedAircraftDto } from "@/lib/api/dips";

const mockFetchDipsOwnedAircrafts = vi.hoisted(() => vi.fn());
vi.mock("@/lib/api/dips", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api/dips")>("@/lib/api/dips");
  return {
    ...actual,
    fetchDipsOwnedAircrafts: mockFetchDipsOwnedAircrafts,
  };
});

import { DipsAuthRequiredClientError, AppSessionExpiredClientError } from "@/lib/api/dips";

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

describe("DipsVerifyButton", () => {
  beforeEach(() => {
    mockFetchDipsOwnedAircrafts.mockReset();
  });

  it("test_verify_shows_message_when_registration_number_missing", () => {
    render(<DipsVerifyButton registrationNumber={null} />);

    expect(
      screen.getByText("登録記号が未設定のためDIPSと照合できません")
    ).toBeInTheDocument();
  });

  it("test_verify_hides_verify_button_when_registration_number_missing", () => {
    render(<DipsVerifyButton registrationNumber={null} />);

    expect(screen.queryByRole("button", { name: "DIPSと照合" })).not.toBeInTheDocument();
  });

  it("test_verify_shows_status_and_valid_period_when_matched", async () => {
    // CodeRabbit 指摘: テスト名は有効期限を対象にしていたが、従来は "有効" の文字列
    // だけを確認しており formatValidPeriodEnd() の呼び出しが削除されてもテストが
    // 通ってしまっていた。ステータスと有効期限 (2028/6/19) の両方を含む結果テキストを
    // 1個のアサーションで確認する。
    mockFetchDipsOwnedAircrafts.mockResolvedValue({ aircrafts: [activeAircraft], excludedCount: 0 });
    const user = userEvent.setup();

    render(<DipsVerifyButton registrationNumber="DUMMY0000001" />);
    await user.click(screen.getByRole("button", { name: "DIPSと照合" }));

    expect(await screen.findByText(/有効・有効期限: 2028\/6\/19/)).toBeInTheDocument();
  });

  it("test_verify_shows_not_found_message_when_no_match", async () => {
    mockFetchDipsOwnedAircrafts.mockResolvedValue({ aircrafts: [activeAircraft], excludedCount: 0 });
    const user = userEvent.setup();

    render(<DipsVerifyButton registrationNumber="JU0000000000" />);
    await user.click(screen.getByRole("button", { name: "DIPSと照合" }));

    expect(
      await screen.findByText("DIPS上に該当する機体が見つかりませんでした")
    ).toBeInTheDocument();
  });

  it("test_verify_shows_dips_login_link_when_auth_required", async () => {
    mockFetchDipsOwnedAircrafts.mockRejectedValue(new DipsAuthRequiredClientError("utm"));
    const user = userEvent.setup();

    render(<DipsVerifyButton registrationNumber="DUMMY0000001" />);
    await user.click(screen.getByRole("button", { name: "DIPSと照合" }));

    const link = await screen.findByRole("link", { name: "DIPSにログインする" });
    expect(link).toHaveAttribute("href", expect.stringContaining("realm=utm"));
  });

  it("test_verify_shows_app_login_link_when_app_session_expired", async () => {
    // B4 回帰テスト: アプリ自体のセッション切れは DIPS の再認可導線とは別の、
    // アプリのログイン画面への導線を表示する
    mockFetchDipsOwnedAircrafts.mockRejectedValue(new AppSessionExpiredClientError());
    const user = userEvent.setup();

    render(<DipsVerifyButton registrationNumber="DUMMY0000001" />);
    await user.click(screen.getByRole("button", { name: "DIPSと照合" }));

    const link = await screen.findByRole("link", { name: "ログイン画面へ" });
    expect(link).toHaveAttribute("href", "/login");
  });

  it("test_verify_does_not_persist_result_across_a_fresh_component_instance", async () => {
    // DB に保存しない (都度取得のみ) ことの間接的な確認: 再マウントすると照合結果は消える
    mockFetchDipsOwnedAircrafts.mockResolvedValue({ aircrafts: [activeAircraft], excludedCount: 0 });
    const user = userEvent.setup();

    const { unmount } = render(<DipsVerifyButton registrationNumber="DUMMY0000001" />);
    await user.click(screen.getByRole("button", { name: "DIPSと照合" }));
    await screen.findByText(/有効/);
    unmount();

    render(<DipsVerifyButton registrationNumber="DUMMY0000001" />);

    expect(screen.queryByText(/有効期限/)).not.toBeInTheDocument();
  });

  it("test_verify_shows_unknown_label_for_unrecognized_status_code", async () => {
    // クライアント側の寛容パース化 (修正2) に伴う表示側フォールバック。別紙1 未定義の
    // ステータスコードでも画面が壊れず「不明」と表示されることを確認する。
    const unknownStatusAircraft: DipsOwnedAircraftDto = {
      ...activeAircraft,
      status: 99,
    };
    mockFetchDipsOwnedAircrafts.mockResolvedValue({
      aircrafts: [unknownStatusAircraft],
      excludedCount: 0,
    });
    const user = userEvent.setup();

    render(<DipsVerifyButton registrationNumber="DUMMY0000001" />);
    await user.click(screen.getByRole("button", { name: "DIPSと照合" }));

    expect(await screen.findByText(/不明/)).toBeInTheDocument();
  });

  it("test_verify_shows_deregistration_reason_suffix_when_reason_code_is_zero", async () => {
    // 回帰テスト (B2 falsy-zero): `{state.aircraft.deregistrationReason && ...}` は
    // deregistrationReason が 0 のとき数字の 0 を描画してしまう (falsy-zero)。
    // null との比較に直すことで、0 (別紙1 未定義のコード値) でも「不明」という
    // ラベル付きの括弧が表示され、裸の "0" が画面に出ないことを確認する。
    const zeroReasonAircraft: DipsOwnedAircraftDto = {
      ...activeAircraft,
      status: 3,
      deregistrationReason: 0,
    };
    mockFetchDipsOwnedAircrafts.mockResolvedValue({
      aircrafts: [zeroReasonAircraft],
      excludedCount: 0,
    });
    const user = userEvent.setup();

    render(<DipsVerifyButton registrationNumber="DUMMY0000001" />);
    await user.click(screen.getByRole("button", { name: "DIPSと照合" }));

    expect(await screen.findByText(/抹消済み \(不明\)/)).toBeInTheDocument();
  });
});
