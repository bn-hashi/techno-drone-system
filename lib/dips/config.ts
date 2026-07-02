import { DipsConfigError } from "@/lib/dips/errors";

/**
 * DIPS 2.0 API の接続設定 (R08-DRS-0005 設定通知書準拠)
 *
 * Client ID は API グループ単位で払い出される:
 * - aircraft   (utm-app-*): 機体情報一覧取得
 * - permission (req-app-*): 許可・承認情報取得 / 許可・承認申請受付
 * - flightPlan (fpl-app-*): 飛行計画情報取得 / 飛行禁止エリア情報取得 / 飛行計画通報受付
 *
 * クレデンシャル値は設定通知書から .env に転記する (リポジトリには一切含めない)。
 * 検証環境はアクセス元 IP 制限 (57.181.4.59) があるため、実通信は本番サーバー上でのみ可能。
 */

export type DipsCredentialGroup = "aircraft" | "permission" | "flightPlan";

export interface DipsGroupCredentials {
  clientId: string;
  clientSecret: string;
}

export interface DipsApplicantIds {
  /** 許可・承認情報取得 (USR063011) */
  permissionGet: string;
  /** 許可・承認申請受付 (USR063021) */
  permissionApply: string;
  /** 飛行計画情報取得 / 飛行禁止エリア情報取得 (USR063031) */
  flightPlanGet: string;
  /** 飛行計画通報受付 (USR063041) */
  flightPlanNotify: string;
}

export interface DipsConfig {
  /** DIPS API のベース URL (例: https://<検証環境ホスト>) */
  baseUrl: string;
  /** OIDC トークンエンドポイント URL */
  tokenUrl: string;
  credentials: Record<DipsCredentialGroup, DipsGroupCredentials>;
  applicantIds: DipsApplicantIds;
}

type EnvSource = Record<string, string | undefined>;

const REQUIRED_ENV_KEYS = [
  "DIPS_API_BASE_URL",
  "DIPS_TOKEN_URL",
  "DIPS_UTM_CLIENT_ID",
  "DIPS_UTM_CLIENT_SECRET",
  "DIPS_REQ_CLIENT_ID",
  "DIPS_REQ_CLIENT_SECRET",
  "DIPS_FPL_CLIENT_ID",
  "DIPS_FPL_CLIENT_SECRET",
  "DIPS_APPLICANT_ID_PERMISSION_GET",
  "DIPS_APPLICANT_ID_PERMISSION_APPLY",
  "DIPS_APPLICANT_ID_FLIGHT_PLAN_GET",
  "DIPS_APPLICANT_ID_FLIGHT_PLAN_NOTIFY",
] as const;

export function isDipsEnabled(env: EnvSource = process.env): boolean {
  return env.DIPS_ENABLED === "true";
}

/** 必須環境変数を検証して設定を組み立てる。不足時は DipsConfigError を投げる */
export function getDipsConfig(env: EnvSource = process.env): DipsConfig {
  const missingKeys = REQUIRED_ENV_KEYS.filter((key) => !env[key]);
  if (missingKeys.length > 0) {
    throw new DipsConfigError(missingKeys);
  }

  return {
    baseUrl: env.DIPS_API_BASE_URL as string,
    tokenUrl: env.DIPS_TOKEN_URL as string,
    credentials: {
      aircraft: {
        clientId: env.DIPS_UTM_CLIENT_ID as string,
        clientSecret: env.DIPS_UTM_CLIENT_SECRET as string,
      },
      permission: {
        clientId: env.DIPS_REQ_CLIENT_ID as string,
        clientSecret: env.DIPS_REQ_CLIENT_SECRET as string,
      },
      flightPlan: {
        clientId: env.DIPS_FPL_CLIENT_ID as string,
        clientSecret: env.DIPS_FPL_CLIENT_SECRET as string,
      },
    },
    applicantIds: {
      permissionGet: env.DIPS_APPLICANT_ID_PERMISSION_GET as string,
      permissionApply: env.DIPS_APPLICANT_ID_PERMISSION_APPLY as string,
      flightPlanGet: env.DIPS_APPLICANT_ID_FLIGHT_PLAN_GET as string,
      flightPlanNotify: env.DIPS_APPLICANT_ID_FLIGHT_PLAN_NOTIFY as string,
    },
  };
}
