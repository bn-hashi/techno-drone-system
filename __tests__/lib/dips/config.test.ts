import { describe, it, expect } from "vitest";
import { isDipsEnabled, getDipsConfig } from "@/lib/dips/config";
import { DipsConfigError } from "@/lib/dips/errors";

const FULL_ENV: Record<string, string> = {
  DIPS_ENABLED: "true",
  DIPS_API_BASE_URL: "https://dips.example.test",
  DIPS_TOKEN_URL: "https://dips.example.test/token",
  DIPS_UTM_CLIENT_ID: "utm-app-test",
  DIPS_UTM_CLIENT_SECRET: "utm-secret",
  DIPS_REQ_CLIENT_ID: "req-app-test",
  DIPS_REQ_CLIENT_SECRET: "req-secret",
  DIPS_FPL_CLIENT_ID: "fpl-app-test",
  DIPS_FPL_CLIENT_SECRET: "fpl-secret",
  DIPS_APPLICANT_ID_PERMISSION_GET: "USR063011",
  DIPS_APPLICANT_ID_PERMISSION_APPLY: "USR063021",
  DIPS_APPLICANT_ID_FLIGHT_PLAN_GET: "USR063031",
  DIPS_APPLICANT_ID_FLIGHT_PLAN_NOTIFY: "USR063041",
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
  it("test_getDipsConfig_returns_grouped_credentials", () => {
    const config = getDipsConfig(FULL_ENV);

    expect(config.credentials.aircraft).toEqual({
      clientId: "utm-app-test",
      clientSecret: "utm-secret",
    });
  });

  it("test_getDipsConfig_returns_applicant_ids", () => {
    const config = getDipsConfig(FULL_ENV);

    expect(config.applicantIds).toEqual({
      permissionGet: "USR063011",
      permissionApply: "USR063021",
      flightPlanGet: "USR063031",
      flightPlanNotify: "USR063041",
    });
  });

  it("test_getDipsConfig_throws_when_required_key_missing", () => {
    const env = { ...FULL_ENV };
    delete env.DIPS_FPL_CLIENT_SECRET;

    expect(() => getDipsConfig(env)).toThrow(DipsConfigError);
  });

  it("test_getDipsConfig_error_message_lists_missing_keys", () => {
    const env = { ...FULL_ENV };
    delete env.DIPS_TOKEN_URL;

    expect(() => getDipsConfig(env)).toThrow(/DIPS_TOKEN_URL/);
  });
});
