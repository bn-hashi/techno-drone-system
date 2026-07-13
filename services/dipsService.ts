import type { DipsApiClient } from "@/lib/dips/dipsApiClient";
import type { DipsOidcClient } from "@/lib/dips/oidcClient";
import type { DipsRealm } from "@/lib/dips/config";
import type {
  DipsPermissionsResponse,
  DipsFlightPlanNotificationResult,
  DipsNotificationUserInput,
} from "@/lib/dips/types";
import { formatDipsStartTime, clampToDipsFlightMinutes } from "@/lib/dips/notificationMapper";
import type { AircraftService } from "@/services/aircraftService";
import type { FlightPlanService } from "@/services/flightPlanService";
import { BusinessError } from "@/services/errors";

/** 飛行計画名称の最大長 (FPRガイドライン 2.3.8) */
const MAX_FLIGHT_PLAN_NAME_LENGTH = 30;

interface AccessContext {
  userId: string;
  isAdmin: boolean;
}

/**
 * DIPS 2.0 連携のビジネスロジック
 *
 * 認証は Authorization Code Flow。realm 別トークンは DipsOidcClient が管理する。
 * 機体情報一覧取得 (utm-app 系) はガイドライン未入手のため未対応。
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
}
