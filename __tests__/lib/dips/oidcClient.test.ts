import { describe, it, expect, vi } from "vitest";
import { DipsOidcClient } from "@/lib/dips/oidcClient";
import { DipsAuthError } from "@/lib/dips/errors";
import type { DipsConfig } from "@/lib/dips/config";

const config: DipsConfig = {
  baseUrl: "https://dips.example.test",
  tokenUrl: "https://dips.example.test/token",
  credentials: {
    aircraft: { clientId: "utm-app-test", clientSecret: "utm-secret" },
    permission: { clientId: "req-app-test", clientSecret: "req-secret" },
    flightPlan: { clientId: "fpl-app-test", clientSecret: "fpl-secret" },
  },
  applicantIds: {
    permissionGet: "USR063011",
    permissionApply: "USR063021",
    flightPlanGet: "USR063031",
    flightPlanNotify: "USR063041",
  },
};

const tokenResponse = (token: string, expiresIn = 3600) =>
  new Response(JSON.stringify({ access_token: token, expires_in: expiresIn }), { status: 200 });

describe("DipsOidcClient", () => {
  it("test_getAccessToken_posts_client_credentials_to_token_url", async () => {
    const fetchMock = vi.fn().mockResolvedValue(tokenResponse("token-1"));
    const client = new DipsOidcClient(config, fetchMock as unknown as typeof fetch);

    await client.getAccessToken("aircraft");

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://dips.example.test/token");
    expect(init.method).toBe("POST");
    expect(init.body).toContain("grant_type=client_credentials");
    expect(init.body).toContain("client_id=utm-app-test");
  });

  it("test_getAccessToken_returns_access_token", async () => {
    const fetchMock = vi.fn().mockResolvedValue(tokenResponse("token-abc"));
    const client = new DipsOidcClient(config, fetchMock as unknown as typeof fetch);

    const token = await client.getAccessToken("permission");

    expect(token).toBe("token-abc");
  });

  it("test_getAccessToken_caches_token_within_expiry", async () => {
    const fetchMock = vi.fn().mockResolvedValue(tokenResponse("token-cached"));
    const client = new DipsOidcClient(config, fetchMock as unknown as typeof fetch);

    await client.getAccessToken("flightPlan");
    await client.getAccessToken("flightPlan");

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("test_getAccessToken_uses_separate_tokens_per_group", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(tokenResponse("token-utm"))
      .mockResolvedValueOnce(tokenResponse("token-req"));
    const client = new DipsOidcClient(config, fetchMock as unknown as typeof fetch);

    await client.getAccessToken("aircraft");
    await client.getAccessToken("permission");

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("test_getAccessToken_refetches_after_expiry", async () => {
    vi.useFakeTimers();
    try {
      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce(tokenResponse("token-old", 120))
        .mockResolvedValueOnce(tokenResponse("token-new", 120));
      const client = new DipsOidcClient(config, fetchMock as unknown as typeof fetch);

      await client.getAccessToken("aircraft");
      // 安全マージン (60秒) を考慮し、期限 120秒 - 60秒 = 60秒経過後は再取得される
      vi.advanceTimersByTime(61_000);
      const token = await client.getAccessToken("aircraft");

      expect(token).toBe("token-new");
      expect(fetchMock).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it("test_getAccessToken_throws_DipsAuthError_on_http_error", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("unauthorized", { status: 401 }));
    const client = new DipsOidcClient(config, fetchMock as unknown as typeof fetch);

    await expect(client.getAccessToken("aircraft")).rejects.toThrow(DipsAuthError);
  });

  it("test_getAccessToken_throws_DipsAuthError_on_malformed_body", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ foo: "bar" }), { status: 200 }));
    const client = new DipsOidcClient(config, fetchMock as unknown as typeof fetch);

    await expect(client.getAccessToken("aircraft")).rejects.toThrow(DipsAuthError);
  });
});
