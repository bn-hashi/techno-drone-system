import type { DipsConfig, DipsCredentialGroup } from "@/lib/dips/config";
import type { DipsOidcClient } from "@/lib/dips/oidcClient";
import { DIPS_ENDPOINTS } from "@/lib/dips/endpoints";
import { DipsApiError } from "@/lib/dips/errors";
import type {
  DipsAircraftInfo,
  DipsPermissionsResponse,
  DipsFlightPlanNotificationPayload,
  DipsFlightPlanNotificationResult,
} from "@/lib/dips/types";

interface RequestOptions {
  method: "GET" | "POST";
  group: DipsCredentialGroup;
  path: string;
  query?: Record<string, string>;
  body?: unknown;
}

/** DIPS API の応答待ちタイムアウト (ms)。無期限ブロックを防ぐ */
const REQUEST_TIMEOUT_MS = 10_000;

/**
 * DIPS 2.0 API クライアント (6 API)
 *
 * 認証は DipsOidcClient から API グループ別のトークンを取得して Bearer 付与する。
 * fetch はテスト容易性のため注入可能。
 *
 * ⚠️ レスポンス形式が設定通知書に記載されていない API (飛行計画情報取得・
 * 飛行禁止エリア情報取得) は unknown を返す。ガイドライン突合後に型を確定させる。
 */
export class DipsApiClient {
  constructor(
    private readonly config: DipsConfig,
    private readonly oidcClient: DipsOidcClient,
    private readonly fetchFn: typeof fetch = fetch
  ) {}

  /** 機体情報一覧取得 (utm-app グループ) */
  async fetchAircraftList(): Promise<DipsAircraftInfo[]> {
    return this.request<DipsAircraftInfo[]>({
      method: "GET",
      group: "aircraft",
      path: DIPS_ENDPOINTS.aircraftList,
    });
  }

  /** 許可・承認情報取得 (req-app グループ) */
  async fetchPermissions(): Promise<DipsPermissionsResponse> {
    return this.request<DipsPermissionsResponse>({
      method: "GET",
      group: "permission",
      path: DIPS_ENDPOINTS.permissionList,
      query: { applicantId: this.config.applicantIds.permissionGet },
    });
  }

  /** 許可・承認申請受付 (req-app グループ)。検証環境は東京航空局宛のみ受付 */
  async submitPermissionApplication(payload: Record<string, unknown>): Promise<unknown> {
    return this.request<unknown>({
      method: "POST",
      group: "permission",
      path: DIPS_ENDPOINTS.permissionApplication,
      body: { ...payload, applicantId: this.config.applicantIds.permissionApply },
    });
  }

  /** 飛行計画情報取得 (fpl-app グループ)。検証環境はデータ未投入のため先に通報が必要 */
  async fetchFlightPlans(): Promise<unknown> {
    return this.request<unknown>({
      method: "GET",
      group: "flightPlan",
      path: DIPS_ENDPOINTS.flightPlanList,
      query: { applicantId: this.config.applicantIds.flightPlanGet },
    });
  }

  /** 飛行禁止エリア情報取得 (fpl-app グループ) */
  async fetchNoFlyAreas(): Promise<unknown> {
    return this.request<unknown>({
      method: "GET",
      group: "flightPlan",
      path: DIPS_ENDPOINTS.noFlyAreaList,
    });
  }

  /** 飛行計画通報受付 (fpl-app グループ) */
  async notifyFlightPlan(
    payload: Omit<DipsFlightPlanNotificationPayload, "applicantId">
  ): Promise<DipsFlightPlanNotificationResult> {
    return this.request<DipsFlightPlanNotificationResult>({
      method: "POST",
      group: "flightPlan",
      path: DIPS_ENDPOINTS.flightPlanNotification,
      body: {
        applicantId: this.config.applicantIds.flightPlanNotify,
        ...payload,
      } satisfies DipsFlightPlanNotificationPayload,
    });
  }

  private async request<T>(options: RequestOptions): Promise<T> {
    const token = await this.oidcClient.getAccessToken(options.group);

    const url = new URL(options.path, this.config.baseUrl);
    for (const [key, value] of Object.entries(options.query ?? {})) {
      url.searchParams.set(key, value);
    }

    let response: Response;
    try {
      response = await this.fetchFn(url.toString(), {
        method: options.method,
        headers: {
          authorization: `Bearer ${token}`,
          accept: "application/json",
          ...(options.body !== undefined ? { "content-type": "application/json" } : {}),
        },
        ...(options.body !== undefined ? { body: JSON.stringify(options.body) } : {}),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch (error) {
      throw new DipsApiError(
        `DIPS API への接続に失敗しました (${options.method} ${options.path})`,
        undefined,
        undefined,
        error
      );
    }

    if (!response.ok) {
      const responseBody = await response.text().catch(() => undefined);
      throw new DipsApiError(
        `DIPS API がエラーを返しました (${options.method} ${options.path})`,
        response.status,
        responseBody
      );
    }

    try {
      return (await response.json()) as T;
    } catch (error) {
      throw new DipsApiError(
        `DIPS API のレスポンス形式が不正です (${options.method} ${options.path})`,
        response.status,
        undefined,
        error
      );
    }
  }
}
