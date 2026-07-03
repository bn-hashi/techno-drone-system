import { DIPS_REALM_NAMES } from "@/lib/dips/config";
import type { DipsConfig, DipsRealm } from "@/lib/dips/config";
import { DipsAuthError, DipsAuthRequiredError } from "@/lib/dips/errors";
import { encryptToken, decryptToken } from "@/lib/dips/tokenCipher";
import type { IDipsTokenRepository } from "@/repositories/dipsTokenRepository";

/**
 * DIPS 2.0 の OIDC トークン管理 (Authorization Code Flow)
 *
 * ガイドライン (FPR v1.9 / FPA v1.4) 2.3.2〜2.3.3 準拠:
 * - ユーザーを DIPS ログイン画面へリダイレクトし、認可コードを redirect_uri で受け取る
 * - コードをトークンに交換 (access_token 約300秒 / refresh_token 約3600秒)
 * - トークンはユーザー × realm 単位で暗号化して DB 保存し、失効前に自動リフレッシュする
 * - リフレッシュトークンも失効している場合は DipsAuthRequiredError (再ログイン誘導)
 */

/** トークン失効前に更新・再取得を始める安全マージン (秒) */
const EXPIRY_SAFETY_MARGIN_SECONDS = 60;

/** トークンエンドポイントの応答待ちタイムアウト (ms)。無期限ブロックを防ぐ */
const TOKEN_REQUEST_TIMEOUT_MS = 10_000;

interface TokenResponseBody {
  access_token?: unknown;
  expires_in?: unknown;
  refresh_token?: unknown;
  refresh_expires_in?: unknown;
}

interface ValidTokenResponse {
  accessToken: string;
  expiresInSeconds: number;
  refreshToken: string;
  refreshExpiresInSeconds: number;
}

export class DipsOidcClient {
  constructor(
    private readonly config: DipsConfig,
    private readonly tokenRepo: IDipsTokenRepository,
    private readonly fetchFn: typeof fetch = fetch
  ) {}

  /** DIPS ログイン画面へ誘導する認可 URL を組み立てる (scope は仕様上の固定値) */
  buildAuthorizationUrl(realm: DipsRealm, state: string): string {
    const url = new URL(this.endpointUrl(realm, "auth"));
    url.searchParams.set("response_type", "code");
    url.searchParams.set("client_id", this.config.credentials[realm].clientId);
    url.searchParams.set("redirect_uri", this.config.redirectUri);
    url.searchParams.set("scope", "openid offline_access");
    url.searchParams.set("state", state);
    url.searchParams.set("ui_locales", "ja");
    return url.toString();
  }

  /** 認可コードをトークンに交換し、暗号化して保存する */
  async exchangeCodeAndStore(userId: string, realm: DipsRealm, code: string): Promise<void> {
    const { clientId, clientSecret } = this.config.credentials[realm];
    const tokens = await this.requestToken(realm, {
      grant_type: "authorization_code",
      code,
      redirect_uri: this.config.redirectUri,
      client_id: clientId,
      client_secret: clientSecret,
    });
    await this.storeTokens(userId, realm, tokens);
  }

  /**
   * 有効なアクセストークンを返す。
   * 失効間近ならリフレッシュし、リフレッシュ不能なら DipsAuthRequiredError を投げる。
   */
  async getAccessToken(userId: string, realm: DipsRealm): Promise<string> {
    const record = await this.tokenRepo.findByUserAndRealm(userId, realm);
    if (!record) {
      throw new DipsAuthRequiredError(realm);
    }

    const marginMs = EXPIRY_SAFETY_MARGIN_SECONDS * 1000;
    if (Date.now() < record.accessTokenExpiresAt.getTime() - marginMs) {
      return decryptToken(record.encryptedAccessToken, this.config.tokenEncryptionKey);
    }

    if (Date.now() >= record.refreshTokenExpiresAt.getTime()) {
      throw new DipsAuthRequiredError(realm);
    }

    const refreshToken = decryptToken(record.encryptedRefreshToken, this.config.tokenEncryptionKey);
    const { clientId, clientSecret } = this.config.credentials[realm];
    const tokens = await this.requestToken(
      realm,
      {
        grant_type: "refresh_token",
        refresh_token: refreshToken,
        client_id: clientId,
        client_secret: clientSecret,
      },
      // リフレッシュトークンが DIPS 側で無効化されている場合は再ログインが必要
      () => new DipsAuthRequiredError(realm)
    );
    await this.storeTokens(userId, realm, tokens);
    return tokens.accessToken;
  }

  private endpointUrl(realm: DipsRealm, endpoint: "auth" | "token"): string {
    const realmName = DIPS_REALM_NAMES[realm];
    return `${this.config.authBaseUrl}/auth/realms/${realmName}/protocol/openid-connect/${endpoint}`;
  }

  private async requestToken(
    realm: DipsRealm,
    params: Record<string, string>,
    invalidGrantErrorFactory?: () => Error
  ): Promise<ValidTokenResponse> {
    let response: Response;
    try {
      response = await this.fetchFn(this.endpointUrl(realm, "token"), {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams(params).toString(),
        signal: AbortSignal.timeout(TOKEN_REQUEST_TIMEOUT_MS),
      });
    } catch (error) {
      throw new DipsAuthError(
        `DIPSトークンエンドポイントへの接続に失敗しました (realm: ${realm})`,
        undefined,
        error
      );
    }

    if (!response.ok) {
      if (invalidGrantErrorFactory && (response.status === 400 || response.status === 401)) {
        throw invalidGrantErrorFactory();
      }
      throw new DipsAuthError(`DIPSトークン取得に失敗しました (realm: ${realm})`, response.status);
    }

    const body = (await response.json().catch(() => null)) as TokenResponseBody | null;
    if (
      !body ||
      typeof body.access_token !== "string" ||
      typeof body.expires_in !== "number" ||
      typeof body.refresh_token !== "string" ||
      typeof body.refresh_expires_in !== "number"
    ) {
      throw new DipsAuthError(`DIPSトークンレスポンスの形式が不正です (realm: ${realm})`);
    }

    return {
      accessToken: body.access_token,
      expiresInSeconds: body.expires_in,
      refreshToken: body.refresh_token,
      refreshExpiresInSeconds: body.refresh_expires_in,
    };
  }

  private async storeTokens(
    userId: string,
    realm: DipsRealm,
    tokens: ValidTokenResponse
  ): Promise<void> {
    const now = Date.now();
    await this.tokenRepo.upsert({
      userId,
      realm,
      encryptedAccessToken: encryptToken(tokens.accessToken, this.config.tokenEncryptionKey),
      encryptedRefreshToken: encryptToken(tokens.refreshToken, this.config.tokenEncryptionKey),
      accessTokenExpiresAt: new Date(now + tokens.expiresInSeconds * 1000),
      refreshTokenExpiresAt: new Date(now + tokens.refreshExpiresInSeconds * 1000),
    });
  }
}
