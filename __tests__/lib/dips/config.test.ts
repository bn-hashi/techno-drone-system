import { describe, it, expect } from "vitest";
import {
  isDipsEnabled,
  getDipsConfig,
  requireRealmCredentials,
  requireAuthBaseUrl,
  requireApiBaseUrl,
  DIPS_REALM_NAMES,
} from "@/lib/dips/config";
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
    expect(DIPS_REALM_NAMES).toEqual({ fpl: "drs-fpl", req: "drs-req", utm: "drs-utm" });
  });
});

describe("getDipsConfig (utm)", () => {
  const UTM_ENV = {
    ...FULL_ENV,
    DIPS_DRS_AUTH_BASE_URL: "https://drs-auth.dips.example.test",
    DIPS_DRS_API_BASE_URL: "https://drs-api.dips.example.test",
    DIPS_UTM_CLIENT_ID: "utm-app-test",
    DIPS_UTM_CLIENT_SECRET: "utm-secret",
  };

  it("test_getDipsConfig_returns_utm_credentials_when_env_present", () => {
    const config = getDipsConfig(UTM_ENV);

    expect(config.credentials.utm).toEqual({
      clientId: "utm-app-test",
      clientSecret: "utm-secret",
    });
  });

  it("test_getDipsConfig_omits_utm_credentials_when_env_missing", () => {
    const config = getDipsConfig(FULL_ENV);

    expect(config.credentials.utm).toBeUndefined();
  });

  it("test_getDipsConfig_does_not_require_utm_env", () => {
    // utm 系を1つも設定しなくても fpl/req 用の config は組み立てられる (既存機能の非退行)
    expect(() => getDipsConfig(FULL_ENV)).not.toThrow();
  });

  it("test_getDipsConfig_returns_drs_base_urls_when_present", () => {
    const config = getDipsConfig(UTM_ENV);

    expect({
      drsAuthBaseUrl: config.drsAuthBaseUrl,
      drsApiBaseUrl: config.drsApiBaseUrl,
    }).toEqual({
      drsAuthBaseUrl: "https://drs-auth.dips.example.test",
      drsApiBaseUrl: "https://drs-api.dips.example.test",
    });
  });
});

describe("requireRealmCredentials", () => {
  it("test_requireRealmCredentials_returns_credentials_when_present", () => {
    const config = getDipsConfig(FULL_ENV);

    expect(requireRealmCredentials(config, "fpl")).toEqual({
      clientId: "fpl-app-test",
      clientSecret: "fpl-secret",
    });
  });

  it("test_requireRealmCredentials_throws_config_error_for_missing_utm", () => {
    const config = getDipsConfig(FULL_ENV);

    expect(() => requireRealmCredentials(config, "utm")).toThrow(DipsConfigError);
  });

  it("test_requireRealmCredentials_error_message_lists_utm_env_keys", () => {
    const config = getDipsConfig(FULL_ENV);

    expect(() => requireRealmCredentials(config, "utm")).toThrow(/DIPS_UTM_CLIENT_ID/);
  });
});

describe("requireAuthBaseUrl", () => {
  it("test_requireAuthBaseUrl_returns_shared_base_url_for_fpl_realm", () => {
    const config = getDipsConfig(FULL_ENV);

    expect(requireAuthBaseUrl(config, "fpl")).toBe("https://auth.dips.example.test");
  });

  it("test_requireAuthBaseUrl_returns_drs_base_url_for_utm_realm", () => {
    const config = getDipsConfig({
      ...FULL_ENV,
      DIPS_DRS_AUTH_BASE_URL: "https://drs-auth.dips.example.test",
    });

    expect(requireAuthBaseUrl(config, "utm")).toBe("https://drs-auth.dips.example.test");
  });

  it("test_requireAuthBaseUrl_throws_config_error_when_drs_base_url_missing", () => {
    const config = getDipsConfig(FULL_ENV);

    expect(() => requireAuthBaseUrl(config, "utm")).toThrow(DipsConfigError);
  });
});

describe("requireApiBaseUrl", () => {
  it("test_requireApiBaseUrl_returns_fpr_base_url", () => {
    const config = getDipsConfig(FULL_ENV);

    expect(requireApiBaseUrl(config, "fpr")).toBe("https://fpr-api.dips.example.test");
  });

  it("test_requireApiBaseUrl_returns_fpa_base_url", () => {
    const config = getDipsConfig(FULL_ENV);

    expect(requireApiBaseUrl(config, "fpa")).toBe("https://fpa-api.dips.example.test");
  });

  it("test_requireApiBaseUrl_returns_drs_base_url_when_present", () => {
    const config = getDipsConfig({
      ...FULL_ENV,
      DIPS_DRS_API_BASE_URL: "https://drs-api.dips.example.test",
    });

    expect(requireApiBaseUrl(config, "drs")).toBe("https://drs-api.dips.example.test");
  });

  it("test_requireApiBaseUrl_throws_config_error_when_drs_base_url_missing", () => {
    const config = getDipsConfig(FULL_ENV);

    expect(() => requireApiBaseUrl(config, "drs")).toThrow(DipsConfigError);
  });
});
