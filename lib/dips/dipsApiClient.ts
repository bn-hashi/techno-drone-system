import type { DipsConfig } from "@/lib/dips/config";
import { requireApiBaseUrl } from "@/lib/dips/config";
import type { DipsOidcClient } from "@/lib/dips/oidcClient";
import { DIPS_ENDPOINTS } from "@/lib/dips/endpoints";
import type { DipsEndpoint } from "@/lib/dips/endpoints";
import { DipsApiError, DipsPossiblyAcceptedTimeoutError } from "@/lib/dips/errors";
import { normalizeAircraftListWithDiagnostics } from "@/lib/dips/aircraftListSchema";
import type { NormalizeAircraftListResult } from "@/lib/dips/aircraftListSchema";
import { normalizePermissionsWithDiagnostics } from "@/lib/dips/permissionsSchema";
import type { NormalizePermissionsResult } from "@/lib/dips/permissionsSchema";
import { normalizeFlightProhibitedAreasWithDiagnostics } from "@/lib/dips/flightProhibitedAreaSchema";
import type { NormalizeFlightProhibitedAreasResult } from "@/lib/dips/flightProhibitedAreaSchema";
import { normalizeFlightPlansWithDiagnostics } from "@/lib/dips/flightPlanSchema";
import type { NormalizeFlightPlansResult } from "@/lib/dips/flightPlanSchema";
import { normalizePermissionApplicationResult } from "@/lib/dips/permissionApplicationSchema";
import { normalizeFlightPlanNotificationResult } from "@/lib/dips/flightPlanNotificationSchema";
import type {
  DipsFlightPlanNotificationPayload,
  DipsFlightPlanNotificationResult,
  DipsFlightProhibitedAreaSearchRequest,
  DipsFlightPlanSearchRequest,
  DipsPermissionApplicationPayload,
  DipsPermissionApplicationResult,
} from "@/lib/dips/types";

/** DIPS API の応答待ちタイムアウト (ms)。無期限ブロックを防ぐ (冪等な GET/検索系向け) */
const REQUEST_TIMEOUT_MS = 10_000;

/**
 * 非冪等な登録系 POST (許可・承認申請受付 / 飛行計画通報受付。`DipsEndpoint.isNonIdempotentWrite`
 * が true のエンドポイント) のタイムアウト (ms)。134項目に及ぶ許可・承認申請登録は
 * REQUEST_TIMEOUT_MS (10秒) を超える可能性が高く、タイムアウトで中断すると DIPS 側では
 * 受理済みの可能性があるにもかかわらず「送信に失敗しました」としか伝わらず、運用者が
 * 再送して共用検証環境DBに重複登録する実害があった (2026-09-06 レビュー I1)。
 * REQUEST_TIMEOUT_MS の3倍を目安に余裕を持たせつつ、無期限待機は避ける。
 */
const NON_IDEMPOTENT_WRITE_TIMEOUT_MS = 30_000;

/**
 * エラーレスポンス本文をログ・例外メッセージへ格納する際の最大長。
 * DRS 系 (機体情報一覧取得) のエラー本文には個人情報が乗りうるため、全文は保持しない。
 */
const RESPONSE_BODY_PREVIEW_LENGTH = 200;

/**
 * `AbortSignal.timeout()` によるタイムアウトで fetch が中断されたかを判定する。
 * 仕様上、この場合の abort reason (= fetch の reject 値) は `name: "TimeoutError"` の
 * DOMException になる (ネットワーク切断等の TypeError とは区別できる)。
 */
function isRequestTimeoutError(error: unknown): boolean {
  return error instanceof Error && error.name === "TimeoutError";
}

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

  /**
   * 飛行計画通報受付 (fpl realm)。レスポンスは境界で検証・正規化してから返す
   * (2026-09-11 req-014 課題1: 以前は素キャストで返しており、ガイドライン §2.3.8 の
   * 実際の応答形状 (トップレベル配列 + flightPlanInfoRegistrationResult 入れ子) との
   * 食い違いにより flightPlanId が常に undefined になっていた。lib/dips/
   * flightPlanNotificationSchema.ts 参照)。
   */
  async notifyFlightPlan(
    userId: string,
    payload: DipsFlightPlanNotificationPayload
  ): Promise<DipsFlightPlanNotificationResult> {
    const raw = await this.request<unknown>(userId, DIPS_ENDPOINTS.flightPlanRegister, payload);
    return normalizeFlightPlanNotificationResult(raw);
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

  /**
   * 飛行禁止エリア情報取得 (fpl realm)。DIPS のワイヤーフォーマットは検索条件を
   * `flightProhibitedAreaInfo.flightProhibitedAreaTypeId` にネストするため、ここで
   * ドメイン層のフラットな `DipsFlightProhibitedAreaSearchRequest` から変換する
   * (FPRガイドライン v1.9 2.3.7 ①リクエストボディ参照)。レスポンスは境界で検証・
   * 正規化してから返す (fetchPermissions と同じ構造)。
   */
  async searchFlightProhibitedAreas(
    userId: string,
    params: DipsFlightProhibitedAreaSearchRequest
  ): Promise<NormalizeFlightProhibitedAreasResult> {
    const raw = await this.request<unknown>(userId, DIPS_ENDPOINTS.flightProhibitedAreaSearch, {
      features: params.features,
      flightProhibitedAreaInfo: {
        flightProhibitedAreaTypeId: params.flightProhibitedAreaTypeIds,
      },
    });
    return normalizeFlightProhibitedAreasWithDiagnostics(raw);
  }

  /**
   * 飛行計画情報取得 (fpl realm)。DIPS のワイヤーフォーマットはドメイン層のリクエスト型と
   * 完全に一致するため (5-5 と異なりネスト変換は不要)、そのまま渡す
   * (FPRガイドライン v1.9 2.3.6 ①リクエストボディ参照)。レスポンスは境界で検証・
   * 正規化してから返す。
   */
  async searchFlightPlans(
    userId: string,
    params: DipsFlightPlanSearchRequest
  ): Promise<NormalizeFlightPlansResult> {
    const raw = await this.request<unknown>(userId, DIPS_ENDPOINTS.flightPlanSearch, params);
    return normalizeFlightPlansWithDiagnostics(raw);
  }

  /**
   * 許可・承認申請受付 (req realm)。5-6 (notifyFlightPlan) と同型の POST。レスポンスは
   * `{ formNum: string }` のみのシンプルな形状のため、境界の検証は
   * `normalizePermissionApplicationResult` に委譲する (共通エンジンではなく専用検証。
   * lib/dips/permissionApplicationSchema.ts のコメント参照)。
   */
  async applyPermission(
    userId: string,
    payload: DipsPermissionApplicationPayload
  ): Promise<DipsPermissionApplicationResult> {
    const raw = await this.request<unknown>(userId, DIPS_ENDPOINTS.permissionRegister, payload);
    return normalizePermissionApplicationResult(raw);
  }

  private baseUrlFor(endpoint: DipsEndpoint): string {
    return requireApiBaseUrl(this.config, endpoint.apiBase);
  }

  private async request<T>(userId: string, endpoint: DipsEndpoint, body?: unknown): Promise<T> {
    const token = await this.oidcClient.getAccessToken(userId, endpoint.realm);
    const url = new URL(endpoint.path, this.baseUrlFor(endpoint)).toString();
    const timeoutMs = endpoint.isNonIdempotentWrite
      ? NON_IDEMPOTENT_WRITE_TIMEOUT_MS
      : REQUEST_TIMEOUT_MS;

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
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (error) {
      if (endpoint.isNonIdempotentWrite && isRequestTimeoutError(error)) {
        // I1: 非冪等な登録系 POST がタイムアウトした場合、DIPS 側では受理済みの可能性が
        // あるため、通常の DipsApiError (「送信に失敗しました」) とは区別し、
        // handleDipsRouteError が専用の案内文を返せるようにする
        throw new DipsPossiblyAcceptedTimeoutError(
          `DIPS API への接続がタイムアウトしました。受理済みの可能性があります (${endpoint.method} ${endpoint.path})`,
          error
        );
      }
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
      // 診断に必要な範囲までに切り詰めて保持する。既定は200文字だが、
      // isErrorBodySafeToDisplay: true の API (PII を含まない業務メッセージのみと
      // 判断した fpl 系) は endpoint.errorBodyPreviewLength (既定1000) まで許す
      // (2026-09-11 req-014 課題2: 長文エラー (必須項目不足の羅列等) が読めるように)
      const previewLength = endpoint.errorBodyPreviewLength ?? RESPONSE_BODY_PREVIEW_LENGTH;
      const responseBody = rawResponseBody?.slice(0, previewLength);
      throw new DipsApiError(
        `DIPS API がエラーを返しました (${endpoint.method} ${endpoint.path})`,
        response.status,
        responseBody,
        undefined,
        endpoint.isErrorBodySafeToDisplay
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
