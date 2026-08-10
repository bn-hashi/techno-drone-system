// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import { DipsOidcClient } from "@/lib/dips/oidcClient";
import { DipsAuthError, DipsAuthRequiredError, DipsConfigError } from "@/lib/dips/errors";
import { encryptToken, decryptToken } from "@/lib/dips/tokenCipher";
import type { DipsConfig } from "@/lib/dips/config";
import type { IDipsTokenRepository } from "@/repositories/dipsTokenRepository";
import type { DipsToken } from "@prisma/client";

const KEY_HEX = "0123456789abcdef".repeat(4);

const config: DipsConfig = {
  authBaseUrl: "https://auth.dips.example.test",
  fprApiBaseUrl: "https://fpr-api.dips.example.test",
  fpaApiBaseUrl: "https://fpa-api.dips.example.test",
  credentials: {
    fpl: { clientId: "fpl-app-test", clientSecret: "fpl-secret" },
    req: { clientId: "req-app-test", clientSecret: "req-secret" },
  },
  redirectUri: "https://app.example.test/redirect",
  tokenEncryptionKey: KEY_HEX,
};

const tokenResponse = (
  accessToken: string,
  { expiresIn = 300, refreshToken = "refresh-1", refreshExpiresIn = 3600 } = {}
) =>
  new Response(
    JSON.stringify({
      access_token: accessToken,
      expires_in: expiresIn,
      refresh_token: refreshToken,
      refresh_expires_in: refreshExpiresIn,
    }),
    { status: 200 }
  );

const makeTokenRecord = (overrides: Partial<DipsToken> = {}): DipsToken =>
  ({
    id: "token-1",
    userId: "user-1",
    realm: "fpl",
    encryptedAccessToken: encryptToken("stored-access", KEY_HEX),
    encryptedRefreshToken: encryptToken("stored-refresh", KEY_HEX),
    accessTokenExpiresAt: new Date(Date.now() + 300_000),
    refreshTokenExpiresAt: new Date(Date.now() + 3_600_000),
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }) as DipsToken;

describe("DipsOidcClient", () => {
  let tokenRepo: IDipsTokenRepository;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    tokenRepo = {
      findByUserAndRealm: vi.fn(),
      upsert: vi.fn(),
      deleteByUserAndRealm: vi.fn(),
    };
    fetchMock = vi.fn();
  });

  const makeClient = () =>
    new DipsOidcClient(config, tokenRepo, fetchMock as unknown as typeof fetch);

  describe("buildAuthorizationUrl", () => {
    it("test_buildAuthorizationUrl_uses_realm_auth_endpoint", () => {
      const url = makeClient().buildAuthorizationUrl("fpl", "state-123");

      expect(url).toContain(
        "https://auth.dips.example.test/auth/realms/drs-fpl/protocol/openid-connect/auth"
      );
    });

    it("test_buildAuthorizationUrl_includes_required_parameters", () => {
      const url = new URL(makeClient().buildAuthorizationUrl("req", "state-123"));

      expect(Object.fromEntries(url.searchParams)).toMatchObject({
        response_type: "code",
        client_id: "req-app-test",
        redirect_uri: "https://app.example.test/redirect",
        scope: "openid offline_access",
        state: "state-123",
      });
    });

    it("test_buildAuthorizationUrl_uses_drs_auth_base_url_for_utm_realm", () => {
      const utmConfig: DipsConfig = {
        ...config,
        drsAuthBaseUrl: "https://drs-auth.dips.example.test",
        credentials: {
          ...config.credentials,
          utm: { clientId: "utm-app-test", clientSecret: "utm-secret" },
        },
      };
      const client = new DipsOidcClient(utmConfig, tokenRepo, fetchMock as unknown as typeof fetch);

      const url = client.buildAuthorizationUrl("utm", "state-123");

      expect(url).toContain(
        "https://drs-auth.dips.example.test/auth/realms/drs-utm/protocol/openid-connect/auth"
      );
    });

    it("test_buildAuthorizationUrl_keeps_existing_base_url_for_fpl_realm", () => {
      const url = makeClient().buildAuthorizationUrl("fpl", "state-123");

      expect(url).toContain(
        "https://auth.dips.example.test/auth/realms/drs-fpl/protocol/openid-connect/auth"
      );
    });

    it("test_buildAuthorizationUrl_throws_config_error_when_utm_credentials_missing", () => {
      expect(() => makeClient().buildAuthorizationUrl("utm", "state-123")).toThrow(
        DipsConfigError
      );
    });
  });

  describe("exchangeCodeAndStore", () => {
    it("test_exchangeCode_posts_to_realm_token_endpoint", async () => {
      fetchMock.mockResolvedValue(tokenResponse("new-access"));
      vi.mocked(tokenRepo.upsert).mockResolvedValue(makeTokenRecord());

      await makeClient().exchangeCodeAndStore("user-1", "fpl", "auth-code-1");

      const [url] = fetchMock.mock.calls[0];
      expect(url).toBe(
        "https://auth.dips.example.test/auth/realms/drs-fpl/protocol/openid-connect/token"
      );
    });

    it("test_exchangeCode_sends_authorization_code_grant_params", async () => {
      fetchMock.mockResolvedValue(tokenResponse("new-access"));
      vi.mocked(tokenRepo.upsert).mockResolvedValue(makeTokenRecord());

      await makeClient().exchangeCodeAndStore("user-1", "fpl", "auth-code-1");

      const [, init] = fetchMock.mock.calls[0];
      expect(Object.fromEntries(new URLSearchParams(init.body))).toMatchObject({
        grant_type: "authorization_code",
        code: "auth-code-1",
      });
    });

    it("test_exchangeCode_stores_encrypted_tokens", async () => {
      fetchMock.mockResolvedValue(tokenResponse("new-access", { refreshToken: "new-refresh" }));
      vi.mocked(tokenRepo.upsert).mockResolvedValue(makeTokenRecord());

      await makeClient().exchangeCodeAndStore("user-1", "fpl", "auth-code-1");

      const input = vi.mocked(tokenRepo.upsert).mock.calls[0][0];
      expect({
        userId: input.userId,
        realm: input.realm,
        accessToken: decryptToken(input.encryptedAccessToken, KEY_HEX),
        refreshToken: decryptToken(input.encryptedRefreshToken, KEY_HEX),
      }).toEqual({
        userId: "user-1",
        realm: "fpl",
        accessToken: "new-access",
        refreshToken: "new-refresh",
      });
    });

    it("test_exchangeCode_throws_DipsAuthError_on_http_error", async () => {
      fetchMock.mockResolvedValue(new Response("bad request", { status: 400 }));

      await expect(makeClient().exchangeCodeAndStore("user-1", "fpl", "bad-code")).rejects.toThrow(
        DipsAuthError
      );
    });

    it("test_exchangeCode_throws_DipsAuthError_on_malformed_body", async () => {
      fetchMock.mockResolvedValue(new Response(JSON.stringify({ foo: "bar" }), { status: 200 }));

      await expect(
        makeClient().exchangeCodeAndStore("user-1", "fpl", "auth-code-1")
      ).rejects.toThrow(DipsAuthError);
    });
  });

  describe("getAccessToken", () => {
    it("test_getAccessToken_throws_AuthRequired_when_no_token_record", async () => {
      vi.mocked(tokenRepo.findByUserAndRealm).mockResolvedValue(null);

      await expect(makeClient().getAccessToken("user-1", "fpl")).rejects.toThrow(
        DipsAuthRequiredError
      );
    });

    it("test_getAccessToken_returns_decrypted_token_when_still_valid", async () => {
      vi.mocked(tokenRepo.findByUserAndRealm).mockResolvedValue(makeTokenRecord());

      const token = await makeClient().getAccessToken("user-1", "fpl");

      expect(token).toBe("stored-access");
    });

    it("test_getAccessToken_skips_fetch_when_still_valid", async () => {
      vi.mocked(tokenRepo.findByUserAndRealm).mockResolvedValue(makeTokenRecord());

      await makeClient().getAccessToken("user-1", "fpl");

      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("test_getAccessToken_refreshes_when_access_token_expired", async () => {
      vi.mocked(tokenRepo.findByUserAndRealm).mockResolvedValue(
        makeTokenRecord({ accessTokenExpiresAt: new Date(Date.now() - 1000) })
      );
      fetchMock.mockResolvedValue(tokenResponse("refreshed-access"));
      vi.mocked(tokenRepo.upsert).mockResolvedValue(makeTokenRecord());

      const token = await makeClient().getAccessToken("user-1", "fpl");

      expect(token).toBe("refreshed-access");
    });

    it("test_getAccessToken_uses_refresh_token_grant_on_refresh", async () => {
      vi.mocked(tokenRepo.findByUserAndRealm).mockResolvedValue(
        makeTokenRecord({ accessTokenExpiresAt: new Date(Date.now() - 1000) })
      );
      fetchMock.mockResolvedValue(tokenResponse("refreshed-access"));
      vi.mocked(tokenRepo.upsert).mockResolvedValue(makeTokenRecord());

      await makeClient().getAccessToken("user-1", "fpl");

      const [, init] = fetchMock.mock.calls[0];
      expect(init.body).toContain("grant_type=refresh_token");
    });

    it("test_getAccessToken_keeps_existing_refresh_token_when_response_omits_it", async () => {
      const record = makeTokenRecord({ accessTokenExpiresAt: new Date(Date.now() - 1000) });
      vi.mocked(tokenRepo.findByUserAndRealm).mockResolvedValue(record);
      // Keycloak は rotation 無効時、refresh 応答から refresh_token を省略することがある
      fetchMock.mockResolvedValue(
        new Response(JSON.stringify({ access_token: "refreshed-access", expires_in: 300 }), {
          status: 200,
        })
      );
      vi.mocked(tokenRepo.upsert).mockResolvedValue(record);

      await makeClient().getAccessToken("user-1", "fpl");

      const input = vi.mocked(tokenRepo.upsert).mock.calls[0][0];
      expect(input.encryptedRefreshToken).toBe(record.encryptedRefreshToken);
    });

    it("test_getAccessToken_deduplicates_concurrent_refreshes", async () => {
      vi.mocked(tokenRepo.findByUserAndRealm).mockResolvedValue(
        makeTokenRecord({ accessTokenExpiresAt: new Date(Date.now() - 1000) })
      );
      fetchMock.mockResolvedValue(tokenResponse("refreshed-access"));
      vi.mocked(tokenRepo.upsert).mockResolvedValue(makeTokenRecord());
      const client = makeClient();

      await Promise.all([
        client.getAccessToken("user-1", "fpl"),
        client.getAccessToken("user-1", "fpl"),
      ]);

      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it("test_getAccessToken_falls_back_to_db_token_when_another_process_refreshed", async () => {
      const staleRecord = makeTokenRecord({ accessTokenExpiresAt: new Date(Date.now() - 1000) });
      const freshRecord = makeTokenRecord({
        encryptedAccessToken: encryptToken("other-process-access", KEY_HEX),
      });
      vi.mocked(tokenRepo.findByUserAndRealm)
        .mockResolvedValueOnce(staleRecord)
        .mockResolvedValueOnce(freshRecord);
      // 別プロセスが先にリフレッシュ済み → rotation により invalid_grant が返る
      fetchMock.mockResolvedValue(new Response("invalid_grant", { status: 400 }));

      const token = await makeClient().getAccessToken("user-1", "fpl");

      expect(token).toBe("other-process-access");
    });

    it("test_getAccessToken_throws_AuthRequired_when_refresh_token_also_expired", async () => {
      vi.mocked(tokenRepo.findByUserAndRealm).mockResolvedValue(
        makeTokenRecord({
          accessTokenExpiresAt: new Date(Date.now() - 1000),
          refreshTokenExpiresAt: new Date(Date.now() - 1000),
        })
      );

      await expect(makeClient().getAccessToken("user-1", "fpl")).rejects.toThrow(
        DipsAuthRequiredError
      );
    });

    it("test_getAccessToken_skips_fetch_when_refresh_token_also_expired", async () => {
      vi.mocked(tokenRepo.findByUserAndRealm).mockResolvedValue(
        makeTokenRecord({
          accessTokenExpiresAt: new Date(Date.now() - 1000),
          refreshTokenExpiresAt: new Date(Date.now() - 1000),
        })
      );

      await makeClient()
        .getAccessToken("user-1", "fpl")
        .catch(() => {});

      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("test_getAccessToken_throws_AuthRequired_when_refresh_rejected_as_invalid_grant", async () => {
      vi.mocked(tokenRepo.findByUserAndRealm).mockResolvedValue(
        makeTokenRecord({ accessTokenExpiresAt: new Date(Date.now() - 1000) })
      );
      fetchMock.mockResolvedValue(new Response("invalid_grant", { status: 400 }));

      await expect(makeClient().getAccessToken("user-1", "fpl")).rejects.toThrow(
        DipsAuthRequiredError
      );
    });

    it("test_getAccessToken_throws_DipsAuthError_when_refresh_fails_with_server_error", async () => {
      vi.mocked(tokenRepo.findByUserAndRealm).mockResolvedValue(
        makeTokenRecord({ accessTokenExpiresAt: new Date(Date.now() - 1000) })
      );
      fetchMock.mockResolvedValue(new Response("server error", { status: 500 }));

      await expect(makeClient().getAccessToken("user-1", "fpl")).rejects.toThrow(DipsAuthError);
    });

    it("test_getAccessToken_wraps_network_failure_in_DipsAuthError", async () => {
      vi.mocked(tokenRepo.findByUserAndRealm).mockResolvedValue(
        makeTokenRecord({ accessTokenExpiresAt: new Date(Date.now() - 1000) })
      );
      fetchMock.mockRejectedValue(new TypeError("fetch failed"));

      await expect(makeClient().getAccessToken("user-1", "fpl")).rejects.toThrow(DipsAuthError);
    });
  });
});
