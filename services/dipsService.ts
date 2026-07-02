import type { DipsApiClient } from "@/lib/dips/dipsApiClient";
import type {
  DipsAircraftInfo,
  DipsPermissionsResponse,
  DipsFlightPlanNotificationResult,
} from "@/lib/dips/types";
import type { AircraftService } from "@/services/aircraftService";
import type { FlightPlanService } from "@/services/flightPlanService";
import { BusinessError } from "@/services/errors";

/** 機体ステータス 1=有効(登録済) (lib/dips/types.ts DipsUaStatus 参照) */
const UA_STATUS_ACTIVE = 1;

const MILLISECONDS_PER_MINUTE = 60_000;

interface AccessContext {
  userId: string;
  isAdmin: boolean;
}

export interface AircraftRegistrationCheck {
  /** DIPS に登録記号が存在し、かつステータスが有効 */
  isRegistered: boolean;
  /** DIPS 上の機体情報 (見つからない場合は null) */
  aircraftInfo: DipsAircraftInfo | null;
}

/**
 * DIPS 2.0 連携のビジネスロジック
 *
 * 所有者チェックは既存の AircraftService / FlightPlanService の
 * findById (非所有者には NotFoundError) に委譲する。
 */
export class DipsService {
  constructor(
    private readonly apiClient: DipsApiClient,
    private readonly aircraftService: AircraftService,
    private readonly flightPlanService: FlightPlanService
  ) {}

  /** 機体の登録記号を DIPS の機体情報一覧と照合する */
  async verifyAircraftRegistration(
    aircraftId: string,
    context: AccessContext
  ): Promise<AircraftRegistrationCheck> {
    const aircraft = await this.aircraftService.findById(aircraftId, context);
    if (!aircraft.registrationNumber) {
      throw new BusinessError("機体に登録記号が設定されていません");
    }

    const dipsAircrafts = await this.apiClient.fetchAircraftList();
    const matched =
      dipsAircrafts.find((info) => info.regSymbol === aircraft.registrationNumber) ?? null;

    return {
      isRegistered: matched !== null && matched.uaStatus === UA_STATUS_ACTIVE,
      aircraftInfo: matched,
    };
  }

  /**
   * 飛行計画を DIPS の飛行計画通報受付 API へ通報する。
   *
   * 検証環境 DB は他事業者と共用のため、重複通報を防ぐ冪等性保護として
   * 既に受付番号が記録されている飛行計画は再通報せず BusinessError を投げる。
   */
  async notifyFlightPlan(
    flightPlanId: string,
    context: AccessContext
  ): Promise<DipsFlightPlanNotificationResult> {
    const plan = await this.flightPlanService.findById(flightPlanId, context);
    if (plan.dipsReceptionNumber) {
      throw new BusinessError("この飛行計画は既にDIPSへ通報済みです");
    }

    const aircraft = await this.aircraftService.findById(plan.aircraftId, context);
    if (!aircraft.registrationNumber) {
      throw new BusinessError("機体に登録記号が設定されていません");
    }

    const flightEndDatetime = new Date(
      plan.plannedAt.getTime() + plan.durationMin * MILLISECONDS_PER_MINUTE
    );

    const result = await this.apiClient.notifyFlightPlan({
      flightStartDatetime: plan.plannedAt.toISOString(),
      flightEndDatetime: flightEndDatetime.toISOString(),
      flightPurpose: plan.purpose,
      flightLocation: plan.location,
      regSymbol: aircraft.registrationNumber,
    });

    await this.flightPlanService.recordDipsNotification(
      flightPlanId,
      result.receptionNumber,
      context
    );

    return result;
  }

  /** 許可・承認情報を取得する (パススルー) */
  async fetchPermissions(): Promise<DipsPermissionsResponse> {
    return this.apiClient.fetchPermissions();
  }

  /** 飛行禁止エリア情報を取得する (パススルー。型はガイドライン突合後に確定) */
  async fetchNoFlyAreas(): Promise<unknown> {
    return this.apiClient.fetchNoFlyAreas();
  }
}
