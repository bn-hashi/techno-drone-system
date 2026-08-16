// @vitest-environment node
import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextResponse } from "next/server";
import { DipsDisabledError, DipsConfigError } from "@/lib/dips/errors";

vi.mock("@/lib/auth/requireFlightAccess", () => ({
  requireFlightAccess: vi.fn(),
}));
vi.mock("@/lib/serviceFactory", () => ({
  getDipsService: vi.fn(),
}));

import { requireFlightAccess } from "@/lib/auth/requireFlightAccess";
import { getDipsService } from "@/lib/serviceFactory";
import { DELETE } from "@/app/api/dips/tokens/[realm]/route";

const mockUnlinkAccount = vi.fn();

const authorizedAsUser1 = { ok: true as const, userId: "user-1", isAdmin: false };
const authorizedAsAdmin = { ok: true as const, userId: "admin-1", isAdmin: true };

const makeRequest = (body?: unknown) =>
  new Request("http://localhost/api/dips/tokens/utm", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

const callDelete = (realm: string, body?: unknown) =>
  DELETE(makeRequest(body), { params: { realm } });

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getDipsService).mockReturnValue({
    unlinkAccount: mockUnlinkAccount,
  } as unknown as ReturnType<typeof getDipsService>);
});

describe("DELETE /api/dips/tokens/[realm]", () => {
  it("test_delete_returns_401_when_not_authenticated", async () => {
    vi.mocked(requireFlightAccess).mockResolvedValue({
      ok: false,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    });

    const response = await callDelete("utm");

    expect(response.status).toBe(401);
  });

  it("test_delete_returns_403_when_role_has_no_flight_access", async () => {
    vi.mocked(requireFlightAccess).mockResolvedValue({
      ok: false,
      response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    });

    const response = await callDelete("utm");

    expect(response.status).toBe(403);
  });

  it("test_delete_returns_401_before_calling_service_when_not_authenticated", async () => {
    // 未認証時はサービス層 (延いてはトークン削除) を一切呼び出さないことを確認する
    vi.mocked(requireFlightAccess).mockResolvedValue({
      ok: false,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    });

    await callDelete("utm");

    expect(mockUnlinkAccount).not.toHaveBeenCalled();
  });

  it("test_delete_returns_400_for_unknown_realm", async () => {
    vi.mocked(requireFlightAccess).mockResolvedValue(authorizedAsUser1);

    const response = await callDelete("not-a-real-realm");

    expect(response.status).toBe(400);
  });

  it("test_delete_does_not_call_service_for_unknown_realm", async () => {
    vi.mocked(requireFlightAccess).mockResolvedValue(authorizedAsUser1);

    await callDelete("not-a-real-realm");

    expect(mockUnlinkAccount).not.toHaveBeenCalled();
  });

  it("test_delete_calls_service_with_session_userId_and_path_realm", async () => {
    vi.mocked(requireFlightAccess).mockResolvedValue(authorizedAsUser1);
    mockUnlinkAccount.mockResolvedValue(undefined);

    await callDelete("utm");

    expect(mockUnlinkAccount).toHaveBeenCalledWith("user-1", "utm");
  });

  it("test_delete_ignores_userId_in_request_body_and_uses_session_userId_instead", async () => {
    // 「他ユーザーのトークンを解除できない」ことをコントローラ層で証明する: リクエスト
    // ボディに別ユーザーの userId を仕込んでも、サービスに渡るのは常にセッションの userId
    vi.mocked(requireFlightAccess).mockResolvedValue(authorizedAsUser1);
    mockUnlinkAccount.mockResolvedValue(undefined);

    await callDelete("utm", { userId: "victim-user" });

    expect(mockUnlinkAccount).toHaveBeenCalledWith("user-1", "utm");
    expect(mockUnlinkAccount).not.toHaveBeenCalledWith("victim-user", "utm");
  });

  it("test_delete_admin_can_only_unlink_own_token_not_an_arbitrary_userId", async () => {
    // ADMIN であっても他人の連携を切れないこと (受け入れ条件4)。ADMIN セッションでも
    // 渡される userId はセッション本人の admin-1 のみ
    vi.mocked(requireFlightAccess).mockResolvedValue(authorizedAsAdmin);
    mockUnlinkAccount.mockResolvedValue(undefined);

    await callDelete("utm", { userId: "some-other-pilot" });

    expect(mockUnlinkAccount).toHaveBeenCalledWith("admin-1", "utm");
  });

  it("test_delete_returns_200_with_success_true", async () => {
    vi.mocked(requireFlightAccess).mockResolvedValue(authorizedAsUser1);
    mockUnlinkAccount.mockResolvedValue(undefined);

    const response = await callDelete("utm");
    const body = await response.json();

    expect({ status: response.status, success: body.success }).toEqual({
      status: 200,
      success: true,
    });
  });

  it("test_delete_returns_200_when_no_token_was_linked_idempotent", async () => {
    // 未連携状態でも Service (deleteMany 経由) は例外を投げないため、そのまま 200 になる
    vi.mocked(requireFlightAccess).mockResolvedValue(authorizedAsUser1);
    mockUnlinkAccount.mockResolvedValue(undefined);

    const response = await callDelete("utm");

    expect(response.status).toBe(200);
  });

  it("test_delete_returns_503_when_dips_is_disabled", async () => {
    vi.mocked(requireFlightAccess).mockResolvedValue(authorizedAsUser1);
    vi.mocked(getDipsService).mockImplementation(() => {
      throw new DipsDisabledError();
    });

    const response = await callDelete("utm");

    expect(response.status).toBe(503);
  });

  it("test_delete_returns_503_on_dips_config_error", async () => {
    vi.mocked(requireFlightAccess).mockResolvedValue(authorizedAsUser1);
    mockUnlinkAccount.mockRejectedValue(new DipsConfigError(["DIPS_UTM_CLIENT_ID"]));

    const response = await callDelete("utm");

    expect(response.status).toBe(503);
  });

  it("test_delete_returns_500_on_unexpected_error", async () => {
    vi.mocked(requireFlightAccess).mockResolvedValue(authorizedAsUser1);
    mockUnlinkAccount.mockRejectedValue(new Error("db down"));

    const response = await callDelete("utm");

    expect(response.status).toBe(500);
  });

  it("test_delete_accepts_fpl_realm", async () => {
    vi.mocked(requireFlightAccess).mockResolvedValue(authorizedAsUser1);
    mockUnlinkAccount.mockResolvedValue(undefined);

    const response = await callDelete("fpl");

    expect(response.status).toBe(200);
  });

  it("test_delete_accepts_req_realm", async () => {
    vi.mocked(requireFlightAccess).mockResolvedValue(authorizedAsUser1);
    mockUnlinkAccount.mockResolvedValue(undefined);

    const response = await callDelete("req");

    expect(response.status).toBe(200);
  });
});
