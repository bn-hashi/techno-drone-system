// @vitest-environment node
import { describe, it, expect, vi, afterEach } from "vitest";
import { handleDipsRouteError } from "@/lib/dips/handleRouteError";
import {
  DipsDisabledError,
  DipsConfigError,
  DipsAuthError,
  DipsApiError,
  DipsAuthRequiredError,
} from "@/lib/dips/errors";
import { logger } from "@/lib/logger";

/**
 * `handleDipsRouteError` は `app/api/dips/aircrafts/route.ts` と
 * `app/api/dips/permissions/route.ts` の catch ブロック (約30行、差分4行程度) を
 * 1本化した共通ハンドラ (2026-08-28 段階2共通化)。両ルートの統合テストとは別に、
 * エンジン自体の分岐契約を直接検証する。
 */
const options = { route: "GET /api/dips/example", label: "サンプル情報" };

describe("handleDipsRouteError", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("test_returns_503_for_dips_disabled_error", async () => {
    const response = handleDipsRouteError(new DipsDisabledError(), options);

    expect(response.status).toBe(503);
  });

  it("test_returns_401_with_auth_required_flag_and_realm_from_error", async () => {
    const response = handleDipsRouteError(new DipsAuthRequiredError("req"), options);
    const body = await response.json();

    expect({ status: response.status, authRequired: body.authRequired, realm: body.realm }).toEqual({
      status: 401,
      authRequired: true,
      realm: "req",
    });
  });

  it("test_never_overrides_realm_with_a_hardcoded_value", async () => {
    // D1 差し戻しの回帰テスト: realm は必ず error.realm を使い、呼び出し側の label/route が
    // 何であっても realm を決め打ちしない (機体情報一覧取得側が realm: "utm" を
    // ハードコードしていた事故の再発防止)
    const response = handleDipsRouteError(new DipsAuthRequiredError("any-realm-value"), {
      route: "GET /api/dips/aircrafts",
      label: "機体情報一覧",
    });
    const body = await response.json();

    expect(body.realm).toBe("any-realm-value");
  });

  it("test_returns_503_and_logs_route_for_dips_config_error", async () => {
    const spy = vi.spyOn(logger, "error").mockImplementation(() => {});
    const error = new DipsConfigError(["DIPS_CLIENT_ID"]);

    const response = handleDipsRouteError(error, options);

    expect(response.status).toBe(503);
    expect(spy).toHaveBeenCalledWith("DIPS連携の設定が不足しています", error, {
      route: "GET /api/dips/example",
    });
  });

  it("test_returns_502_and_logs_label_specific_message_for_dips_api_error", async () => {
    const spy = vi.spyOn(logger, "error").mockImplementation(() => {});
    const error = new DipsApiError("failed");

    const response = handleDipsRouteError(error, options);

    expect(response.status).toBe(502);
    expect(spy).toHaveBeenCalledWith("DIPSサンプル情報取得に失敗しました", error, {
      route: "GET /api/dips/example",
    });
  });

  it("test_returns_502_for_dips_auth_error", async () => {
    vi.spyOn(logger, "error").mockImplementation(() => {});

    const response = handleDipsRouteError(new DipsAuthError("failed"), options);

    expect(response.status).toBe(502);
  });

  it("test_returns_500_and_logs_label_specific_message_for_unexpected_error", async () => {
    const spy = vi.spyOn(logger, "error").mockImplementation(() => {});
    const error = new Error("unexpected");

    const response = handleDipsRouteError(error, options);

    expect(response.status).toBe(500);
    expect(spy).toHaveBeenCalledWith("サンプル情報取得で内部エラーが発生しました", error, {
      route: "GET /api/dips/example",
    });
  });

  it("test_client_facing_error_body_never_contains_the_label", async () => {
    // 対象名 (label) はログ専用で、クライアントに返す error メッセージには含めない
    // (機体一覧取得/許可情報取得の既存レスポンス文言 "DIPS連携でエラーが発生しました" 等を
    // 維持する)
    vi.spyOn(logger, "error").mockImplementation(() => {});

    const response = handleDipsRouteError(new DipsApiError("failed"), options);
    const body = await response.json();

    expect(body.error).not.toContain("サンプル情報");
  });
});
