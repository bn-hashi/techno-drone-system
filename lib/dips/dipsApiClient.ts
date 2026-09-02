import type { DipsConfig } from "@/lib/dips/config";
import { requireApiBaseUrl } from "@/lib/dips/config";
import type { DipsOidcClient } from "@/lib/dips/oidcClient";
import { DIPS_ENDPOINTS } from "@/lib/dips/endpoints";
import type { DipsEndpoint } from "@/lib/dips/endpoints";
import { DipsApiError } from "@/lib/dips/errors";
import { normalizeAircraftListWithDiagnostics } from "@/lib/dips/aircraftListSchema";
import type { NormalizeAircraftListResult } from "@/lib/dips/aircraftListSchema";
import { normalizePermissionsWithDiagnostics } from "@/lib/dips/permissionsSchema";
import type { NormalizePermissionsResult } from "@/lib/dips/permissionsSchema";
import type {
  DipsFlightPlanNotificationPayload,
  DipsFlightPlanNotificationResult,
} from "@/lib/dips/types";

/** DIPS API の応答待ちタイムアウト (ms)。無期限ブロックを防ぐ */
const REQUEST_TIMEOUT_MS = 10_000;

/**
 * エラーレスポンス本文をログ・例外メッセージへ格納する際の最大長。
 * DRS 系 (機体情報一覧取得) のエラー本文には個人情報が乗りうるため、全文は保持しない。
 */
const RESPONSE_BODY_PREVIEW_LENGTH = 200;

/**
 * DIPS 2.0 API クライアント
 *
 * 認証は DipsOidcClient から realm 別・ユーザー別のアクセストークンを取得して Bearer 付与する。
 * ベース URL は endpoint の apiBase (fpr/fpa/drs) で切り替える。fetch はテスト容易性のため注入可能。
 */
export class DipsApiClient {
  constructor(
    private readonly config: DipsConfig,
    private readonly oidcClient: DipsOidcClient,
    private readonly fetchFn: typeof fetch = fetch
  ) {}

  /**
   * 許可・承認情報取得 (req realm)。レスポンスは境界で検証・正規化してから返す
   * (機体情報一覧取得 (fetchAircraftList) と同じ構造。lib/dips/permissionsSchema.ts 参照)。
   * `excludedCount` はパースに失敗して除外した許可の件数 (機体情報一覧取得の C3 対応と
   * 同じ考え方。UI が「除外があったのに0件と表示する」誤表示を避けるために使う)。
   */
  async fetchPermissions(userId: string): Promise<NormalizePermissionsResult> {
    const raw = await this.request<unknown>(userId, DIPS_ENDPOINTS.permissionList);
    return normalizePermissionsWithDiagnostics(raw);
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

  /**
   * 機体情報一覧取得 (utm realm)。レスポンスは境界で検証・正規化してから返す。
   * `excludedCount` はパースに失敗して除外した機体の件数 (C3: UI が「除外があったのに
   * 0件と表示する」誤表示を避けるために使う)。
   */
  async fetchAircraftList(userId: string): Promise<NormalizeAircraftListResult> {
    const raw = await this.request<unknown>(userId, DIPS_ENDPOINTS.aircraftList);
    return normalizeAircraftListWithDiagnostics(raw);
  }

  private baseUrlFor(endpoint: DipsEndpoint): string {
    return requireApiBaseUrl(this.config, endpoint.apiBase);
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
      const rawResponseBody = await response.text().catch(() => undefined);
      // DRS 系 (機体情報一覧取得) のエラー本文には個人情報が乗りうるため、
      // 診断に必要な範囲 (先頭 200 文字) までに切り詰めて保持する
      const responseBody = rawResponseBody?.slice(0, RESPONSE_BODY_PREVIEW_LENGTH);
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
