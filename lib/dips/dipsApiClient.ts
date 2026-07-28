import type { DipsConfig } from "@/lib/dips/config";
import type { DipsOidcClient } from "@/lib/dips/oidcClient";
import { DIPS_ENDPOINTS } from "@/lib/dips/endpoints";
import type { DipsEndpoint } from "@/lib/dips/endpoints";
import { DipsApiError } from "@/lib/dips/errors";
import type {
  DipsPermissionsResponse,
  DipsFlightPlanNotificationPayload,
  DipsFlightPlanNotificationResult,
} from "@/lib/dips/types";

/** DIPS API の応答待ちタイムアウト (ms)。無期限ブロックを防ぐ */
const REQUEST_TIMEOUT_MS = 10_000;

/**
 * DIPS 2.0 API クライアント
 *
 * 認証は DipsOidcClient から realm 別・ユーザー別のアクセストークンを取得して Bearer 付与する。
 * ベース URL は endpoint の apiBase (fpr/fpa) で切り替える。fetch はテスト容易性のため注入可能。
 *
 * 機体情報一覧取得 (utm-app 系) は DRS API ガイドライン §2.3.6 で仕様公開済みだが未実装
 * (docs/dips-rearchitecture-plan.md 参照)。
 */
export class DipsApiClient {
  constructor(
    private readonly config: DipsConfig,
    private readonly oidcClient: DipsOidcClient,
    private readonly fetchFn: typeof fetch = fetch
  ) {}

  /** 許可・承認情報取得 (req realm) */
  async fetchPermissions(userId: string): Promise<DipsPermissionsResponse> {
    return this.request<DipsPermissionsResponse>(userId, DIPS_ENDPOINTS.permissionList);
  }

  /** 飛行計画通報受付 (fpl realm) */
  async notifyFlightPlan(
    userId: string,
    payload: DipsFlightPlanNotificationPayload
  ): Promise<DipsFlightPlanNotificationResult> {
    return this.request<DipsFlightPlanNotificationResult>(
      userId,
      DIPS_ENDPOINTS.flightPlanRegister,
      payload
    );
  }

  private baseUrlFor(endpoint: DipsEndpoint): string {
    return endpoint.apiBase === "fpr" ? this.config.fprApiBaseUrl : this.config.fpaApiBaseUrl;
  }

  private async request<T>(userId: string, endpoint: DipsEndpoint, body?: unknown): Promise<T> {
    const token = await this.oidcClient.getAccessToken(userId, endpoint.realm);
    const url = new URL(endpoint.path, this.baseUrlFor(endpoint)).toString();

    let response: Response;
    try {
      response = await this.fetchFn(url, {
        method: endpoint.method,
        headers: {
          authorization: `Bearer ${token}`,
          accept: "application/json",
          ...(body !== undefined ? { "content-type": "application/json;charset=UTF-8" } : {}),
        },
        ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch (error) {
      throw new DipsApiError(
        `DIPS API への接続に失敗しました (${endpoint.method} ${endpoint.path})`,
        undefined,
        undefined,
        error
      );
    }

    if (!response.ok) {
      const responseBody = await response.text().catch(() => undefined);
      throw new DipsApiError(
        `DIPS API がエラーを返しました (${endpoint.method} ${endpoint.path})`,
        response.status,
        responseBody
      );
    }

    try {
      return (await response.json()) as T;
    } catch (error) {
      throw new DipsApiError(
        `DIPS API のレスポンス形式が不正です (${endpoint.method} ${endpoint.path})`,
        response.status,
        undefined,
        error
      );
    }
  }
}
