import { describe, it, expect } from "vitest";
import { isDipsEnabled, getDipsConfig, DIPS_REALM_NAMES } from "@/lib/dips/config";
import { DipsConfigError } from "@/lib/dips/errors";

const FULL_ENV: Record<string, string> = {
  DIPS_ENABLED: "true",
  DIPS_AUTH_BASE_URL: "https://auth.dips.example.test",
  DIPS_FPR_API_BASE_URL: "https://fpr-api.dips.example.test",
  DIPS_FPA_API_BASE_URL: "https://fpa-api.dips.example.test",
  DIPS_FPL_CLIENT_ID: "fpl-app-test",
  DIPS_FPL_CLIENT_SECRET: "fpl-secret",
  DIPS_REQ_CLIENT_ID: "req-app-test",
  DIPS_REQ_CLIENT_SECRET: "req-secret",
  DIPS_REDIRECT_URI: "https://techno-drone-system.example.test/redirect",
  // AES-256-GCM 用 32byte (64桁hex) のテスト鍵
  DIPS_TOKEN_ENCRYPTION_KEY: "a".repeat(64),
};

describe("isDipsEnabled", () => {
  it("test_isDipsEnabled_returns_true_when_env_is_true", () => {
    expect(isDipsEnabled({ DIPS_ENABLED: "true" })).toBe(true);
  });

  it("test_isDipsEnabled_returns_false_when_env_is_missing", () => {
    expect(isDipsEnabled({})).toBe(false);
  });

  it("test_isDipsEnabled_returns_false_when_env_is_other_value", () => {
    expect(isDipsEnabled({ DIPS_ENABLED: "1" })).toBe(false);
  });
});

describe("getDipsConfig", () => {
  it("test_getDipsConfig_returns_base_urls", () => {
    const config = getDipsConfig(FULL_ENV);

    expect({
      authBaseUrl: config.authBaseUrl,
      fprApiBaseUrl: config.fprApiBaseUrl,
      fpaApiBaseUrl: config.fpaApiBaseUrl,
    }).toEqual({
      authBaseUrl: "https://auth.dips.example.test",
      fprApiBaseUrl: "https://fpr-api.dips.example.test",
      fpaApiBaseUrl: "https://fpa-api.dips.example.test",
    });
  });

  it("test_getDipsConfig_returns_realm_credentials", () => {
    const config = getDipsConfig(FULL_ENV);

    expect(config.credentials).toEqual({
      fpl: { clientId: "fpl-app-test", clientSecret: "fpl-secret" },
      req: { clientId: "req-app-test", clientSecret: "req-secret" },
    });
  });

  it("test_getDipsConfig_returns_redirect_uri", () => {
    const config = getDipsConfig(FULL_ENV);

    expect(config.redirectUri).toBe("https://techno-drone-system.example.test/redirect");
  });

  it("test_getDipsConfig_returns_encryption_key", () => {
    const config = getDipsConfig(FULL_ENV);

    expect(config.tokenEncryptionKey).toBe("a".repeat(64));
  });

  it("test_getDipsConfig_throws_when_required_key_missing", () => {
    const env = { ...FULL_ENV };
    delete env.DIPS_FPL_CLIENT_SECRET;

    expect(() => getDipsConfig(env)).toThrow(DipsConfigError);
  });

  it("test_getDipsConfig_error_message_lists_missing_keys", () => {
    const env = { ...FULL_ENV };
    delete env.DIPS_AUTH_BASE_URL;

    expect(() => getDipsConfig(env)).toThrow(/DIPS_AUTH_BASE_URL/);
  });

  it("test_getDipsConfig_throws_when_encryption_key_is_not_64_hex_chars", () => {
    const env = { ...FULL_ENV, DIPS_TOKEN_ENCRYPTION_KEY: "tooshort" };

    expect(() => getDipsConfig(env)).toThrow(DipsConfigError);
  });
});

describe("DIPS_REALM_NAMES", () => {
  it("test_realm_names_map_to_keycloak_realms", () => {
    expect(DIPS_REALM_NAMES).toEqual({ fpl: "drs-fpl", req: "drs-req" });
  });
});
