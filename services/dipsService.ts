import type { DipsApiClient } from "@/lib/dips/dipsApiClient";
import type { DipsOidcClient } from "@/lib/dips/oidcClient";
import type { DipsRealm } from "@/lib/dips/config";
import type { NormalizePermissionsResult } from "@/lib/dips/permissionsSchema";
import type { NormalizeFlightProhibitedAreasResult } from "@/lib/dips/flightProhibitedAreaSchema";
import type { DipsFlightProhibitedAreaSearchInput } from "@/lib/dips/flightProhibitedAreaSearchInputSchema";
import type {
  DipsFlightPlanNotificationResult,
  DipsNotificationUserInput,
  DipsAircraftInfo,
  DipsOwnedAircraftDto,
} from "@/lib/dips/types";
import { formatDipsStartTime, clampToDipsFlightMinutes } from "@/lib/dips/notificationMapper";
import { DIPS_UA_STATUS_ACTIVE } from "@/lib/constants/dipsAircraftStatus";
import type { AircraftService } from "@/services/aircraftService";
import type { FlightPlanService } from "@/services/flightPlanService";
import { BusinessError } from "@/services/errors";

/** 飛行計画名称の最大長 (FPRガイドライン 2.3.8) */
const MAX_FLIGHT_PLAN_NAME_LENGTH = 30;

/** DIPS 機体重量 (kg) → 本システムの機体重量 (g) の単位変換係数 */
const GRAMS_PER_KILOGRAM = 1000;

interface ListOwnedAircraftsOptions {
  /** true なら抹消済み・有効期限切れの機体も含める (既定は有効な機体のみ) */
  includeInvalid?: boolean;
}

/** listOwnedAircrafts() の戻り値。除外件数は C3 (UI の誤表示防止) のために伝搬する */
export interface ListOwnedAircraftsResult {
  aircrafts: DipsOwnedAircraftDto[];
  /** DIPS レスポンスのうちパースに失敗して除外した機体の件数 */
  excludedCount: number;
}

interface AccessContext {
  userId: string;
  isAdmin: boolean;
}

/**
 * DIPS 2.0 連携のビジネスロジック
 *
 * 認証は Authorization Code Flow。realm 別トークンは DipsOidcClient が管理する。
 * 機体情報一覧取得 (utm-app 系, DRS API ガイドライン §2.3.6) は listOwnedAircrafts() で
 * 実装済み (詳細: docs/dips-drs-aircraft-list-api.md)。
 */
export class DipsService {
  constructor(
    private readonly apiClient: DipsApiClient,
    private readonly oidcClient: DipsOidcClient,
    private readonly aircraftService: AircraftService,
    private readonly flightPlanService: FlightPlanService
  ) {}

  /** DIPS ログイン (認可コードフロー) 開始 URL を返す */
  buildAuthorizationUrl(realm: DipsRealm, state: string): string {
    return this.oidcClient.buildAuthorizationUrl(realm, state);
  }

  /** 認可コードをトークンに交換して保存する */
  async completeAuthorization(userId: string, realm: DipsRealm, code: string): Promise<void> {
    await this.oidcClient.exchangeCodeAndStore(userId, realm, code);
  }

  /**
   * 飛行計画を DIPS の飛行計画通報受付 API へ通報する。
   *
   * 既に通報済み (dipsFlightPlanId あり) の飛行計画は再通報せず BusinessError を投げる (冪等性保護)。
   * FlightPlan/Aircraft から導出できない項目 (飛行目的・空域・速度など) は userInput で受け取る。
   */
  async notifyFlightPlan(
    flightPlanId: string,
    userInput: DipsNotificationUserInput,
    context: AccessContext
  ): Promise<DipsFlightPlanNotificationResult> {
    const plan = await this.flightPlanService.findById(flightPlanId, context);
    if (plan.dipsFlightPlanId) {
      throw new BusinessError("この飛行計画は既にDIPSへ通報済みです");
    }

    const aircraft = await this.aircraftService.findById(plan.aircraftId, context);
    if (!aircraft.registrationNumber) {
      throw new BusinessError("機体に登録記号が設定されていません");
    }

    const result = await this.apiClient.notifyFlightPlan(context.userId, {
      flightPlanInfo: {
        flightPlanId: "",
        name: plan.title.slice(0, MAX_FLIGHT_PLAN_NAME_LENGTH),
        flightPurpose: userInput.flightPurpose,
        flightAirspace: userInput.flightAirspace,
        assistantsNumber: userInput.assistantsNumber,
        departurePoint: userInput.departurePoint,
        destinationPoint: userInput.destinationPoint,
        startTime: formatDipsStartTime(plan.plannedAt),
        plannedMaxTime: clampToDipsFlightMinutes(aircraft.maxFlightTimeMin),
        plannedFlightTime: clampToDipsFlightMinutes(plan.durationMin),
        flightSpeed: userInput.flightSpeed,
        flightAltitude: userInput.flightAltitude,
        flyRoute: userInput.flyRoute,
        riskMitigationOnsiteControl: userInput.riskMitigationOnsiteControl ? "1" : "0",
        aircraftInfo: [{ symbol: aircraft.registrationNumber }],
      },
    });

    await this.flightPlanService.recordDipsNotification(flightPlanId, result.flightPlanId, context);

    return result;
  }

  /**
   * 許可・承認情報を取得する (パススルー)。
   * 正規化 (寛容パース・エントリ単位のフォールバック) は DipsApiClient.fetchPermissions()
   * が境界 (HTTP レスポンス受信直後) で行う。Service 層で追加のビジネスロジック
   * (フィルタ・DTO変換等) が必要になったら listOwnedAircrafts() のようにここへ実装する。
   */
  async fetchPermissions(userId: string): Promise<NormalizePermissionsResult> {
    return this.apiClient.fetchPermissions(userId);
  }

  /**
   * 飛行禁止エリア情報を検索する (パススルー)。
   * 正規化 (寛容パース・エントリ単位のフォールバック) は DipsApiClient.searchFlightProhibitedAreas()
   * が境界で行う。フォーム入力 (フラットな座標・種別コード配列) から DIPS のリクエスト形
   * (features + flightProhibitedAreaTypeIds) への変換もここで行う。
   */
  async searchFlightProhibitedAreas(
    userId: string,
    input: DipsFlightProhibitedAreaSearchInput
  ): Promise<NormalizeFlightProhibitedAreasResult> {
    return this.apiClient.searchFlightProhibitedAreas(userId, {
      features: {
        type: "Circle",
        center: [input.centerLongitude, input.centerLatitude],
        radius: input.radiusMeters,
      },
      flightProhibitedAreaTypeIds: input.flightProhibitedAreaTypeIds,
    });
  }

  /**
   * DIPS 連携を解除する (realm 単位)。
   *
   * 対象は引数の userId のみ。この関数自体は誰の連携でも解除できてしまうため、
   * 「他ユーザーの連携を解除できない」という制約は呼び出し元 (Controller) が
   * セッションの userId だけを渡すことで担保する (リクエストから userId を受け取らない)。
   * realm 単位で削除するため、他 realm (例: utm を解除しても fpl/req) のトークンは残る
   * (`DipsOidcClient.unlinkAccount` 参照)。未連携の状態で呼んでもエラーにしない (冪等)。
   */
  async unlinkAccount(userId: string, realm: DipsRealm): Promise<void> {
    await this.oidcClient.unlinkAccount(userId, realm);
  }

  /**
   * DIPS ログイン済みアカウントが所有する機体一覧を取得する (機体情報一覧取得 API)。
   *
   * 既定では機体ステータスが有効 (aircraft_status === 1) な機体のみ返す。判定ルールの
   * 対象は機体情報 (aircraft_information.aircraft_status) であり、登録記号
   * (registration_code) 自体はステータス値を持たない。有効性の判定は aircraft_status を
   * 正とし、有効期限 (validPeriodEnd) は補助表示に留める (別紙1 のテストデータは全機体が
   * 同一の有効期限を持ち、ステータス値のみで期限切れを区別しているため)。抹消済み・
   * 期限切れ・ステータス不明 (null) の機体は誤った登録記号の取り込みを防ぐため
   * isSelectable=false とする。
   *
   * `excludedCount` は DIPS レスポンスのパースに失敗して除外した機体の件数を伝搬する
   * (C3: UI が「除外があったのに0件と表示する」誤表示を避けるために使う)。
   */
  async listOwnedAircrafts(
    userId: string,
    options: ListOwnedAircraftsOptions = {}
  ): Promise<ListOwnedAircraftsResult> {
    const { aircrafts, excludedCount } = await this.apiClient.fetchAircraftList(userId);
    const target = options.includeInvalid
      ? aircrafts
      : aircrafts.filter((aircraft) => aircraft.uaStatus === DIPS_UA_STATUS_ACTIVE);
    return {
      aircrafts: target
        .map(toOwnedAircraftDto)
        .sort((a, b) => a.registrationCode.localeCompare(b.registrationCode)),
      excludedCount,
    };
  }
}

function toOwnedAircraftDto(aircraft: DipsAircraftInfo): DipsOwnedAircraftDto {
  return {
    registrationCode: aircraft.regSymbol,
    manufacturer: aircraft.makerNameJa,
    modelNumber: aircraft.modelNameJa,
    serialNumber: aircraft.serialNumber,
    // weightKg が null (値が欠落／数値化できなかった) の場合は捏造の 0g にせず null のまま伝える
    weightGrams: aircraft.weightKg === null ? null : Math.round(aircraft.weightKg * GRAMS_PER_KILOGRAM),
    status: aircraft.uaStatus,
    deregistrationReason: aircraft.deregistrationReason,
    validPeriodEnd: aircraft.validPeriodEnd,
    remoteIdType: aircraft.remoteIdType,
    ownerCategory: aircraft.ownerCategory,
    isSelectable: aircraft.uaStatus === DIPS_UA_STATUS_ACTIVE,
  };
}
