import type { DipsApiClient } from "@/lib/dips/dipsApiClient";
import type { DipsOidcClient } from "@/lib/dips/oidcClient";
import type { DipsRealm } from "@/lib/dips/config";
import type {
  DipsPermissionsResponse,
  DipsFlightPlanNotificationResult,
  DipsNotificationUserInput,
  DipsAircraftInfo,
  DipsOwnedAircraftDto,
} from "@/lib/dips/types";
import { formatDipsStartTime, clampToDipsFlightMinutes } from "@/lib/dips/notificationMapper";
import type { AircraftService } from "@/services/aircraftService";
import type { FlightPlanService } from "@/services/flightPlanService";
import { BusinessError } from "@/services/errors";

/** 飛行計画名称の最大長 (FPRガイドライン 2.3.8) */
const MAX_FLIGHT_PLAN_NAME_LENGTH = 30;

/** DIPS 機体重量 (kg) → 本システムの機体重量 (g) の単位変換係数 */
const GRAMS_PER_KILOGRAM = 1000;

/** 機体ステータス: 1=有効な機体 (登録済)。別紙1 のコード値定義に準拠 */
const AIRCRAFT_STATUS_ACTIVE = 1;

interface ListOwnedAircraftsOptions {
  /** true なら抹消済み・有効期限切れの機体も含める (既定は有効な機体のみ) */
  includeInvalid?: boolean;
}

interface AccessContext {
  userId: string;
  isAdmin: boolean;
}

/**
 * DIPS 2.0 連携のビジネスロジック
 *
 * 認証は Authorization Code Flow。realm 別トークンは DipsOidcClient が管理する。
 * 機体情報一覧取得 (utm-app 系) は DRS API ガイドライン §2.3.6 で仕様公開済みだが未対応
 * (docs/dips-rearchitecture-plan.md 参照)。
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

  /** 許可・承認情報を取得する (パススルー) */
  async fetchPermissions(userId: string): Promise<DipsPermissionsResponse> {
    return this.apiClient.fetchPermissions(userId);
  }

  /**
   * DIPS ログイン済みアカウントが所有する機体一覧を取得する (機体情報一覧取得 API)。
   *
   * 既定では機体ステータスが有効 (registration_code の aircraft_status === 1) な機体のみ
   * 返す。有効性の判定は aircraft_status を正とし、有効期限 (validPeriodEnd) は補助表示に
   * 留める (別紙1 のテストデータは全機体が同一の有効期限を持ち、ステータス値のみで
   * 期限切れを区別しているため)。抹消済み・期限切れの機体は誤った登録記号の取り込みを
   * 防ぐため isSelectable=false とする。
   */
  async listOwnedAircrafts(
    userId: string,
    options: ListOwnedAircraftsOptions = {}
  ): Promise<DipsOwnedAircraftDto[]> {
    const aircrafts = await this.apiClient.fetchAircraftList(userId);
    const target = options.includeInvalid
      ? aircrafts
      : aircrafts.filter((aircraft) => aircraft.uaStatus === AIRCRAFT_STATUS_ACTIVE);
    return target
      .map(toOwnedAircraftDto)
      .sort((a, b) => a.registrationCode.localeCompare(b.registrationCode));
  }
}

function toOwnedAircraftDto(aircraft: DipsAircraftInfo): DipsOwnedAircraftDto {
  return {
    registrationCode: aircraft.regSymbol,
    manufacturer: aircraft.makerNameJa,
    modelNumber: aircraft.modelNameJa,
    serialNumber: aircraft.serialNumber,
    weightGrams: Math.round(aircraft.weightKg * GRAMS_PER_KILOGRAM),
    status: aircraft.uaStatus,
    deregistrationReason: aircraft.deregistrationReason,
    validPeriodEnd: aircraft.validPeriodEnd,
    remoteIdType: aircraft.remoteIdType,
    ownerCategory: aircraft.ownerCategory,
    isSelectable: aircraft.uaStatus === AIRCRAFT_STATUS_ACTIVE,
  };
}
