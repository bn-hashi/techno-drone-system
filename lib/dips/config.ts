import { DipsConfigError } from "@/lib/dips/errors";

/**
 * DIPS 2.0 API の接続設定 (接続システム向けガイドライン FPR v1.9 / FPA v1.4 準拠)
 *
 * 認証は OIDC Authorization Code Flow。realm は系統別に分かれており、
 * それぞれ専用の Client ID / Secret が払い出される:
 * - fpl (realm: drs-fpl): 飛行計画情報取得 / 飛行禁止エリア情報取得 / 飛行計画通報受付
 * - req (realm: drs-req): 許可・承認情報取得 / 許可・承認申請受付
 *
 * 機体情報一覧取得 (utm-app 系, realm: drs-utm) は DRS API ガイドライン §2.3.6 で仕様公開済み・
 * R08-DRS-0005 で申請承認済みだが未実装 (仕様待ちではなく実装未着手。docs/dips-rearchitecture-plan.md 参照)。
 *
 * クレデンシャル値は設定通知書から .env に転記する (リポジトリには一切含めない)。
 * 検証環境はアクセス元 IP 制限 (57.181.4.59) があるため、実通信は本番サーバー上でのみ可能。
 */

export type DipsRealm = "fpl" | "req";

/** realm キー → Keycloak realm 名 */
export const DIPS_REALM_NAMES: Record<DipsRealm, string> = {
  fpl: "drs-fpl",
  req: "drs-req",
};

export interface DipsRealmCredentials {
  clientId: string;
  clientSecret: string;
}

export interface DipsConfig {
  /** 認証系 (Keycloak) ベース URL。検証: https://www.stg.uafp.dips.mlit.go.jp */
  authBaseUrl: string;
  /** 飛行計画 API 系ベース URL。検証: https://www.stg.uafpi.dips.mlit.go.jp */
  fprApiBaseUrl: string;
  /** 許可・承認 API 系ベース URL。検証: https://www.stg.uafp.dips.mlit.go.jp */
  fpaApiBaseUrl: string;
  credentials: Record<DipsRealm, DipsRealmCredentials>;
  /** DIPS に登録済みのリダイレクト URL (完全一致が必要) */
  redirectUri: string;
  /** トークン暗号化 (AES-256-GCM) 鍵。32byte = 64桁 hex */
  tokenEncryptionKey: string;
}

type EnvSource = Record<string, string | undefined>;

const REQUIRED_ENV_KEYS = [
  "DIPS_AUTH_BASE_URL",
  "DIPS_FPR_API_BASE_URL",
  "DIPS_FPA_API_BASE_URL",
  "DIPS_FPL_CLIENT_ID",
  "DIPS_FPL_CLIENT_SECRET",
  "DIPS_REQ_CLIENT_ID",
  "DIPS_REQ_CLIENT_SECRET",
  "DIPS_REDIRECT_URI",
  "DIPS_TOKEN_ENCRYPTION_KEY",
] as const;

/** AES-256 鍵は 32byte。hex 表現で 64 文字 */
const ENCRYPTION_KEY_HEX_LENGTH = 64;
const ENCRYPTION_KEY_PATTERN = new RegExp(`^[0-9a-fA-F]{${ENCRYPTION_KEY_HEX_LENGTH}}$`);

export function isDipsEnabled(env: EnvSource = process.env): boolean {
  return env.DIPS_ENABLED === "true";
}

/** 必須環境変数を検証して設定を組み立てる。不足・不正時は DipsConfigError を投げる */
export function getDipsConfig(env: EnvSource = process.env): DipsConfig {
  const missingKeys = REQUIRED_ENV_KEYS.filter((key) => !env[key]);
  if (missingKeys.length > 0) {
    throw new DipsConfigError(missingKeys);
  }

  const tokenEncryptionKey = env.DIPS_TOKEN_ENCRYPTION_KEY as string;
  if (!ENCRYPTION_KEY_PATTERN.test(tokenEncryptionKey)) {
    throw new DipsConfigError(["DIPS_TOKEN_ENCRYPTION_KEY (64桁のhex文字列が必要)"]);
  }

  return {
    authBaseUrl: env.DIPS_AUTH_BASE_URL as string,
    fprApiBaseUrl: env.DIPS_FPR_API_BASE_URL as string,
    fpaApiBaseUrl: env.DIPS_FPA_API_BASE_URL as string,
    credentials: {
      fpl: {
        clientId: env.DIPS_FPL_CLIENT_ID as string,
        clientSecret: env.DIPS_FPL_CLIENT_SECRET as string,
      },
      req: {
        clientId: env.DIPS_REQ_CLIENT_ID as string,
        clientSecret: env.DIPS_REQ_CLIENT_SECRET as string,
      },
    },
    redirectUri: env.DIPS_REDIRECT_URI as string,
    tokenEncryptionKey,
  };
}
