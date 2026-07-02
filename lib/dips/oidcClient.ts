import type { DipsConfig, DipsCredentialGroup } from "@/lib/dips/config";
import { DipsAuthError } from "@/lib/dips/errors";

/** トークン失効前に再取得を始める安全マージン (秒) */
const EXPIRY_SAFETY_MARGIN_SECONDS = 60;

/** トークンエンドポイントの応答待ちタイムアウト (ms)。無期限ブロックを防ぐ */
const TOKEN_REQUEST_TIMEOUT_MS = 10_000;

interface CachedToken {
  token: string;
  /** epoch ms。この時刻を過ぎたら再取得する */
  expiresAt: number;
}

interface TokenResponseBody {
  access_token?: unknown;
  expires_in?: unknown;
}

/**
 * DIPS 2.0 の OIDC トークン管理 (client_credentials グラント)
 *
 * Client ID は API グループ単位で払い出されるため、グループごとに
 * トークンを取得・キャッシュする。fetch はテスト容易性のため注入可能。
 */
export class DipsOidcClient {
  private readonly cache = new Map<DipsCredentialGroup, CachedToken>();

  constructor(
    private readonly config: DipsConfig,
    private readonly fetchFn: typeof fetch = fetch
  ) {}

  async getAccessToken(group: DipsCredentialGroup): Promise<string> {
    const cached = this.cache.get(group);
    if (cached && Date.now() < cached.expiresAt) {
      return cached.token;
    }

    const { clientId, clientSecret } = this.config.credentials[group];
    let response: Response;
    try {
      response = await this.fetchFn(this.config.tokenUrl, {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "client_credentials",
          client_id: clientId,
          client_secret: clientSecret,
        }).toString(),
        signal: AbortSignal.timeout(TOKEN_REQUEST_TIMEOUT_MS),
      });
    } catch (error) {
      throw new DipsAuthError(
        `DIPSトークンエンドポイントへの接続に失敗しました (グループ: ${group})`,
        undefined,
        error
      );
    }

    if (!response.ok) {
      throw new DipsAuthError(
        `DIPSトークン取得に失敗しました (グループ: ${group})`,
        response.status
      );
    }

    const body = (await response.json().catch(() => null)) as TokenResponseBody | null;
    if (!body || typeof body.access_token !== "string" || typeof body.expires_in !== "number") {
      throw new DipsAuthError(`DIPSトークンレスポンスの形式が不正です (グループ: ${group})`);
    }

    const expiresAt = Date.now() + (body.expires_in - EXPIRY_SAFETY_MARGIN_SECONDS) * 1000;
    this.cache.set(group, { token: body.access_token, expiresAt });
    return body.access_token;
  }
}
