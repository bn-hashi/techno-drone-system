import { DIPS_REALM_NAMES, requireRealmCredentials, requireAuthBaseUrl } from "@/lib/dips/config";
import type { DipsConfig, DipsRealm } from "@/lib/dips/config";
import { DipsAuthError, DipsAuthRequiredError } from "@/lib/dips/errors";
import { encryptToken, decryptToken } from "@/lib/dips/tokenCipher";
import type { IDipsTokenRepository } from "@/repositories/dipsTokenRepository";
import type { DipsToken } from "@prisma/client";

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

/**
 * 進行中のリフレッシュ (userId:realm 単位)。
 * refresh token rotation 有効時、同じ refresh_token を並行使用すると後発が invalid_grant に
 * なるため、プロセス内では単一のリフレッシュに相乗りさせる。インスタンスはリクエスト毎に
 * 生成されるためモジュールレベルで共有する。
 */
const inFlightRefreshes = new Map<string, Promise<string>>();

interface TokenResponseBody {
  access_token?: unknown;
  expires_in?: unknown;
  refresh_token?: unknown;
  refresh_expires_in?: unknown;
}

interface TokenGrantResult {
  accessToken: string;
  expiresInSeconds: number;
  /** Keycloak は rotation 無効時、refresh 応答で省略することがある */
  refreshToken?: string;
  refreshExpiresInSeconds?: number;
}

export class DipsOidcClient {
  constructor(
    private readonly config: DipsConfig,
    private readonly tokenRepo: IDipsTokenRepository,
    private readonly fetchFn: typeof fetch = fetch
  ) {}

  /** DIPS ログイン画面へ誘導する認可 URL を組み立てる (scope は仕様上の固定値) */
  buildAuthorizationUrl(realm: DipsRealm, state: string): string {
    const { clientId } = requireRealmCredentials(this.config, realm);
    const url = new URL(this.endpointUrl(realm, "auth"));
    url.searchParams.set("response_type", "code");
    url.searchParams.set("client_id", clientId);
    url.searchParams.set("redirect_uri", this.config.redirectUri);
    url.searchParams.set("scope", "openid offline_access");
    url.searchParams.set("state", state);
    url.searchParams.set("ui_locales", "ja");
    return url.toString();
  }

  /** 認可コードをトークンに交換し、暗号化して保存する */
  async exchangeCodeAndStore(userId: string, realm: DipsRealm, code: string): Promise<void> {
    const { clientId, clientSecret } = requireRealmCredentials(this.config, realm);
    const tokens = await this.requestToken(realm, {
      grant_type: "authorization_code",
      code,
      redirect_uri: this.config.redirectUri,
      client_id: clientId,
      client_secret: clientSecret,
    });
    if (tokens.refreshToken === undefined || tokens.refreshExpiresInSeconds === undefined) {
      throw new DipsAuthError(`DIPSトークンレスポンスの形式が不正です (realm: ${realm})`);
    }
    await this.storeTokens(userId, realm, {
      accessToken: tokens.accessToken,
      expiresInSeconds: tokens.expiresInSeconds,
      encryptedRefreshToken: encryptToken(tokens.refreshToken, this.config.tokenEncryptionKey),
      refreshTokenExpiresAt: new Date(Date.now() + tokens.refreshExpiresInSeconds * 1000),
    });
  }

  /**
   * DIPS 連携を解除する (realm 単位)。該当するトークン行を削除する。
   *
   * `tokenRepo.deleteByUserAndRealm` は userId + realm の複合条件で削除するため、
   * 他 realm (例: utm 解除時の fpl/req) や他ユーザーの行には影響しない。
   * 未連携 (該当行が存在しない) 状態で呼んでも Prisma の deleteMany は例外を投げないため、
   * この呼び出しは冪等になる。
   */
  async unlinkAccount(userId: string, realm: DipsRealm): Promise<void> {
    await this.tokenRepo.deleteByUserAndRealm(userId, realm);
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

    if (this.isAccessTokenUsable(record)) {
      return decryptToken(record.encryptedAccessToken, this.config.tokenEncryptionKey);
    }

    if (Date.now() >= record.refreshTokenExpiresAt.getTime()) {
      throw new DipsAuthRequiredError(realm);
    }

    // 同一ユーザー×realm の並行リフレッシュは1本に相乗りさせる (rotation での invalid_grant 回避)
    const key = `${userId}:${realm}`;
    const existing = inFlightRefreshes.get(key);
    if (existing) {
      return existing;
    }
    const refreshPromise = this.refreshAndStore(userId, realm, record).finally(() => {
      inFlightRefreshes.delete(key);
    });
    inFlightRefreshes.set(key, refreshPromise);
    return refreshPromise;
  }

  private isAccessTokenUsable(record: DipsToken): boolean {
    const marginMs = EXPIRY_SAFETY_MARGIN_SECONDS * 1000;
    return Date.now() < record.accessTokenExpiresAt.getTime() - marginMs;
  }

  private async refreshAndStore(
    userId: string,
    realm: DipsRealm,
    record: DipsToken
  ): Promise<string> {
    const refreshToken = decryptToken(record.encryptedRefreshToken, this.config.tokenEncryptionKey);
    const { clientId, clientSecret } = requireRealmCredentials(this.config, realm);

    let tokens: TokenGrantResult;
    try {
      tokens = await this.requestToken(
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
    } catch (error) {
      if (error instanceof DipsAuthRequiredError) {
        // 複数プロセス構成では別プロセスが先にリフレッシュして rotation 済みの可能性がある。
        // DB を再読込し、有効なアクセストークンが保存されていればそれを使う。
        const latest = await this.tokenRepo.findByUserAndRealm(userId, realm);
        if (latest && this.isAccessTokenUsable(latest)) {
          return decryptToken(latest.encryptedAccessToken, this.config.tokenEncryptionKey);
        }
      }
      throw error;
    }

    await this.storeTokens(userId, realm, {
      accessToken: tokens.accessToken,
      expiresInSeconds: tokens.expiresInSeconds,
      // rotation 無効時は refresh 応答に refresh_token が含まれないため既存値を維持する
      encryptedRefreshToken:
        tokens.refreshToken !== undefined
          ? encryptToken(tokens.refreshToken, this.config.tokenEncryptionKey)
          : record.encryptedRefreshToken,
      refreshTokenExpiresAt:
        tokens.refreshExpiresInSeconds !== undefined
          ? new Date(Date.now() + tokens.refreshExpiresInSeconds * 1000)
          : record.refreshTokenExpiresAt,
    });
    return tokens.accessToken;
  }

  private endpointUrl(realm: DipsRealm, endpoint: "auth" | "token"): string {
    const realmName = DIPS_REALM_NAMES[realm];
    const authBaseUrl = requireAuthBaseUrl(this.config, realm);
    return `${authBaseUrl}/auth/realms/${realmName}/protocol/openid-connect/${endpoint}`;
  }

  private async requestToken(
    realm: DipsRealm,
    params: Record<string, string>,
    invalidGrantErrorFactory?: () => Error
  ): Promise<TokenGrantResult> {
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
    if (!body || typeof body.access_token !== "string" || typeof body.expires_in !== "number") {
      throw new DipsAuthError(`DIPSトークンレスポンスの形式が不正です (realm: ${realm})`);
    }

    return {
      accessToken: body.access_token,
      expiresInSeconds: body.expires_in,
      refreshToken: typeof body.refresh_token === "string" ? body.refresh_token : undefined,
      refreshExpiresInSeconds:
        typeof body.refresh_expires_in === "number" ? body.refresh_expires_in : undefined,
    };
  }

  private async storeTokens(
    userId: string,
    realm: DipsRealm,
    tokens: {
      accessToken: string;
      expiresInSeconds: number;
      encryptedRefreshToken: string;
      refreshTokenExpiresAt: Date;
    }
  ): Promise<void> {
    await this.tokenRepo.upsert({
      userId,
      realm,
      encryptedAccessToken: encryptToken(tokens.accessToken, this.config.tokenEncryptionKey),
      encryptedRefreshToken: tokens.encryptedRefreshToken,
      accessTokenExpiresAt: new Date(Date.now() + tokens.expiresInSeconds * 1000),
      refreshTokenExpiresAt: tokens.refreshTokenExpiresAt,
    });
  }
}
