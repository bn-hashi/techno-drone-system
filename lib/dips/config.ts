import { DipsConfigError } from "@/lib/dips/errors";

/**
 * DIPS 2.0 API の接続設定 (接続システム向けガイドライン FPR v1.9 / FPA v1.4 準拠)
 *
 * 認証は OIDC Authorization Code Flow。realm は系統別に分かれており、
 * それぞれ専用の Client ID / Secret が払い出される:
 * - fpl (realm: drs-fpl): 飛行計画情報取得 / 飛行禁止エリア情報取得 / 飛行計画通報受付
 * - req (realm: drs-req): 許可・承認情報取得 / 許可・承認申請受付
 * - utm (realm: drs-utm): 機体情報一覧取得 (DRS API ガイドライン §2.3.6)
 *
 * utm 系は fpl/req と認証ドメインが異なる (DRS API ガイドライン §3.1) ため、
 * 専用の認証/API ベース URL (drsAuthBaseUrl / drsApiBaseUrl) を持つ。
 * また utm 系の環境変数は REQUIRED_ENV_KEYS に含めない (lazy validation)。
 * 本番 .env に utm 系の値を入れるまでの間、既存の fpl/req 機能を巻き添えで
 * 止めないため。utm 未設定のまま機体情報一覧取得を呼び出した場合のみ
 * requireRealmCredentials() / requireAuthBaseUrl() / requireApiBaseUrl() が
 * DipsConfigError を投げる。
 *
 * クレデンシャル値は設定通知書から .env に転記する (リポジトリには一切含めない)。
 * 検証環境はアクセス元 IP 制限 (57.181.4.59) があるため、実通信は本番サーバー上でのみ可能。
 */

export type DipsRealm = "fpl" | "req" | "utm";

/** realm キー → Keycloak realm 名 */
export const DIPS_REALM_NAMES: Record<DipsRealm, string> = {
  fpl: "drs-fpl",
  req: "drs-req",
  utm: "drs-utm",
};

/** realm キー → クレデンシャル環境変数のプレフィックス (不足時のエラーメッセージ生成用) */
const REALM_CREDENTIAL_ENV_PREFIX: Record<DipsRealm, string> = {
  fpl: "DIPS_FPL",
  req: "DIPS_REQ",
  utm: "DIPS_UTM",
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
  /** utm (機体情報一覧取得) 系の認証ベース URL。fpl/req とドメインが異なる。未設定なら utm 機能のみ利用不可 */
  drsAuthBaseUrl?: string;
  /** utm (機体情報一覧取得) 系の API ベース URL。未設定なら utm 機能のみ利用不可 */
  drsApiBaseUrl?: string;
  /** realm ごとのクレデンシャル。utm は環境変数が揃っている場合のみ含まれる */
  credentials: Partial<Record<DipsRealm, DipsRealmCredentials>>;
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

/** utm 系クレデンシャルが揃っている場合のみ組み立てる (両方揃わないと undefined) */
function buildUtmCredentials(env: EnvSource): DipsRealmCredentials | undefined {
  const clientId = env.DIPS_UTM_CLIENT_ID;
  const clientSecret = env.DIPS_UTM_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return undefined;
  }
  return { clientId, clientSecret };
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

  const utmCredentials = buildUtmCredentials(env);

  return {
    authBaseUrl: env.DIPS_AUTH_BASE_URL as string,
    fprApiBaseUrl: env.DIPS_FPR_API_BASE_URL as string,
    fpaApiBaseUrl: env.DIPS_FPA_API_BASE_URL as string,
    drsAuthBaseUrl: env.DIPS_DRS_AUTH_BASE_URL,
    drsApiBaseUrl: env.DIPS_DRS_API_BASE_URL,
    credentials: {
      fpl: {
        clientId: env.DIPS_FPL_CLIENT_ID as string,
        clientSecret: env.DIPS_FPL_CLIENT_SECRET as string,
      },
      req: {
        clientId: env.DIPS_REQ_CLIENT_ID as string,
        clientSecret: env.DIPS_REQ_CLIENT_SECRET as string,
      },
      ...(utmCredentials ? { utm: utmCredentials } : {}),
    },
    redirectUri: env.DIPS_REDIRECT_URI as string,
    tokenEncryptionKey,
  };
}

/** realm のクレデンシャルを返す。未設定 (utm 等) なら DipsConfigError を投げる */
export function requireRealmCredentials(
  config: DipsConfig,
  realm: DipsRealm
): DipsRealmCredentials {
  const credentials = config.credentials[realm];
  if (!credentials) {
    const prefix = REALM_CREDENTIAL_ENV_PREFIX[realm];
    throw new DipsConfigError([`${prefix}_CLIENT_ID`, `${prefix}_CLIENT_SECRET`]);
  }
  return credentials;
}

/** realm の認証 (Keycloak) ベース URL を返す。utm は drsAuthBaseUrl 未設定なら DipsConfigError */
export function requireAuthBaseUrl(config: DipsConfig, realm: DipsRealm): string {
  if (realm === "utm") {
    if (!config.drsAuthBaseUrl) {
      throw new DipsConfigError(["DIPS_DRS_AUTH_BASE_URL"]);
    }
    return config.drsAuthBaseUrl;
  }
  return config.authBaseUrl;
}

/** 系統別の API ベース URL を返す。drs は drsApiBaseUrl 未設定なら DipsConfigError */
export function requireApiBaseUrl(config: DipsConfig, apiBase: "fpr" | "fpa" | "drs"): string {
  if (apiBase === "fpr") return config.fprApiBaseUrl;
  if (apiBase === "fpa") return config.fpaApiBaseUrl;
  if (!config.drsApiBaseUrl) {
    throw new DipsConfigError(["DIPS_DRS_API_BASE_URL"]);
  }
  return config.drsApiBaseUrl;
}
