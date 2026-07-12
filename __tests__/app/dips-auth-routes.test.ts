// @vitest-environment node
import { describe, it, expect, beforeEach, vi } from "vitest";
import { encodeAuthState } from "@/lib/dips/authState";
import {
  DIPS_STATE_COOKIE_NAME,
  DIPS_RETURN_COOKIE_NAME,
} from "@/lib/dips/authCookie";

/**
 * DIPS 認可フローの returnPath 引き回し (NG#3 対応) のルートテスト
 *
 * - /api/dips/auth/start: 検証済み returnPath のみ cookie 保存すること
 * - /redirect: cookie の戻り先を再検証して使い、不正値は既定へフォールバックすること
 *   (cookie は攻撃者がブラウザ側で書き換えられるため、読み出し時の再検証が必須)
 */

// 呼び出しをまたいで共有する in-memory cookie ストア
const cookieStore = new Map<string, string>();
const setCookieSpy = vi.fn(
  (name: string, value: string, _options?: Record<string, unknown>) => {
    cookieStore.set(name, value);
  }
);

vi.mock("next/headers", () => ({
  cookies: () => ({
    get: (name: string) =>
      cookieStore.has(name) ? { name, value: cookieStore.get(name) as string } : undefined,
    set: (name: string, value: string, options?: Record<string, unknown>) => {
      setCookieSpy(name, value, options);
    },
    delete: (name: string) => {
      cookieStore.delete(name);
    },
  }),
}));

vi.mock("@/lib/auth/requireFlightAccess", () => ({
  requireFlightAccess: vi.fn(),
}));

vi.mock("@/lib/serviceFactory", () => ({
  getDipsService: vi.fn(),
}));

import { requireFlightAccess } from "@/lib/auth/requireFlightAccess";
import { getDipsService } from "@/lib/serviceFactory";
import { GET as startGet } from "@/app/api/dips/auth/start/route";
import { GET as redirectGet } from "@/app/redirect/route";

const mockBuildAuthorizationUrl = vi.fn();
const mockCompleteAuthorization = vi.fn();

const APP_BASE_URL = "http://localhost:3000";

beforeEach(() => {
  vi.clearAllMocks();
  cookieStore.clear();
  process.env.APP_BASE_URL = APP_BASE_URL;
  vi.mocked(requireFlightAccess).mockResolvedValue({
    ok: true,
    userId: "user-1",
    isAdmin: false,
  });
  vi.mocked(getDipsService).mockReturnValue({
    buildAuthorizationUrl: mockBuildAuthorizationUrl,
    completeAuthorization: mockCompleteAuthorization,
  } as unknown as ReturnType<typeof getDipsService>);
  mockBuildAuthorizationUrl.mockReturnValue("https://dips.example.test/auth?client_id=x");
  mockCompleteAuthorization.mockResolvedValue(undefined);
});

describe("GET /api/dips/auth/start (returnPath cookie)", () => {
  it("test_start_with_safe_return_path_saves_return_cookie", async () => {
    const req = new Request(
      "http://localhost/api/dips/auth/start?realm=fpl&returnPath=%2Fflight%2Fplans%2Fabc123"
    );

    const response = await startGet(req);

    expect(response.status).toBe(307);
    expect(setCookieSpy).toHaveBeenCalledWith(
      DIPS_RETURN_COOKIE_NAME,
      "/flight/plans/abc123",
      expect.objectContaining({ httpOnly: true, secure: true, sameSite: "lax" })
    );
  });

  it("test_start_with_external_url_return_path_does_not_save_cookie", async () => {
    const req = new Request(
      `http://localhost/api/dips/auth/start?realm=fpl&returnPath=${encodeURIComponent(
        "https://evil.example.com/flight/plans"
      )}`
    );

    await startGet(req);

    expect(cookieStore.has(DIPS_RETURN_COOKIE_NAME)).toBe(false);
  });

  it("test_start_with_non_flight_return_path_does_not_save_cookie", async () => {
    const req = new Request(
      "http://localhost/api/dips/auth/start?realm=fpl&returnPath=%2Fadmin%2Fusers"
    );

    await startGet(req);

    expect(cookieStore.has(DIPS_RETURN_COOKIE_NAME)).toBe(false);
  });

  it("test_start_without_return_path_does_not_save_cookie", async () => {
    const req = new Request("http://localhost/api/dips/auth/start?realm=fpl");

    await startGet(req);

    expect(cookieStore.has(DIPS_RETURN_COOKIE_NAME)).toBe(false);
  });
});

describe("GET /redirect (returnPath consumption)", () => {
  const buildCallbackRequest = (nonce: string) => {
    const state = encodeAuthState("fpl", nonce);
    return new Request(
      `http://localhost/redirect?code=auth-code-1&state=${encodeURIComponent(state)}`
    );
  };

  it("test_redirect_with_saved_return_path_redirects_to_original_page", async () => {
    cookieStore.set(DIPS_STATE_COOKIE_NAME, "nonce-1");
    cookieStore.set(DIPS_RETURN_COOKIE_NAME, "/flight/plans/abc123");

    const response = await redirectGet(buildCallbackRequest("nonce-1"));

    expect(response.headers.get("location")).toBe(
      `${APP_BASE_URL}/flight/plans/abc123?dips=linked`
    );
  });

  it("test_redirect_with_saved_return_path_deletes_return_cookie", async () => {
    cookieStore.set(DIPS_STATE_COOKIE_NAME, "nonce-1");
    cookieStore.set(DIPS_RETURN_COOKIE_NAME, "/flight/plans/abc123");

    await redirectGet(buildCallbackRequest("nonce-1"));

    expect(cookieStore.has(DIPS_RETURN_COOKIE_NAME)).toBe(false);
  });

  it("test_redirect_with_tampered_return_cookie_falls_back_to_default", async () => {
    // 攻撃者がブラウザ側で cookie を外部 URL に書き換えたケース
    cookieStore.set(DIPS_STATE_COOKIE_NAME, "nonce-1");
    cookieStore.set(DIPS_RETURN_COOKIE_NAME, "https://evil.example.com/phish");

    const response = await redirectGet(buildCallbackRequest("nonce-1"));

    expect(response.headers.get("location")).toBe(`${APP_BASE_URL}/flight/plans?dips=linked`);
  });

  it("test_redirect_without_return_cookie_falls_back_to_default", async () => {
    cookieStore.set(DIPS_STATE_COOKIE_NAME, "nonce-1");

    const response = await redirectGet(buildCallbackRequest("nonce-1"));

    expect(response.headers.get("location")).toBe(`${APP_BASE_URL}/flight/plans?dips=linked`);
  });

  it("test_redirect_with_state_mismatch_returns_to_saved_path_with_error", async () => {
    cookieStore.set(DIPS_STATE_COOKIE_NAME, "different-nonce");
    cookieStore.set(DIPS_RETURN_COOKIE_NAME, "/flight/plans/abc123");

    const response = await redirectGet(buildCallbackRequest("nonce-1"));

    expect(response.headers.get("location")).toBe(
      `${APP_BASE_URL}/flight/plans/abc123?dips=state_error`
    );
  });
});
