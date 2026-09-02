import { describe, it, expect, vi, beforeEach } from "vitest";
import { DipsService } from "@/services/dipsService";
import type { DipsApiClient } from "@/lib/dips/dipsApiClient";
import type { DipsOidcClient } from "@/lib/dips/oidcClient";
import type { DipsNotificationUserInput, DipsAircraftInfo } from "@/lib/dips/types";
import type { AircraftService } from "@/services/aircraftService";
import type { FlightPlanService } from "@/services/flightPlanService";
import { FlightPlanNotFoundError, BusinessError } from "@/services/errors";
import { DipsAuthRequiredError } from "@/lib/dips/errors";
import type { Aircraft, FlightPlan } from "@prisma/client";
import { FlightPlanStatus } from "@prisma/client";

const makeAircraft = (overrides: Partial<Aircraft> = {}): Aircraft =>
  ({
    id: "aircraft-1",
    userId: "user-1",
    name: "テスト機体",
    manufacturer: "テストメーカー",
    modelNumber: "T-1",
    serialNumber: "SN-1",
    weightGrams: 500,
    maxFlightTimeMin: 20,
    registrationNumber: "JU1234567890",
    isActive: true,
    createdAt: new Date("2026-07-01"),
    updatedAt: new Date("2026-07-01"),
    ...overrides,
  }) as Aircraft;

const makePlan = (overrides: Partial<FlightPlan> = {}): FlightPlan =>
  ({
    id: "plan-1",
    userId: "user-1",
    aircraftId: "aircraft-1",
    title: "訓練飛行",
    location: "東京都港区",
    plannedAt: new Date("2026-07-03T10:00:00+09:00"),
    durationMin: 60,
    purpose: "操縦訓練",
    status: FlightPlanStatus.APPROVED,
    dipsFlightPlanId: null,
    createdAt: new Date("2026-07-01"),
    updatedAt: new Date("2026-07-01"),
    ...overrides,
  }) as FlightPlan;

const userInput: DipsNotificationUserInput = {
  flightPurpose: [15],
  flightAirspace: [1],
  assistantsNumber: 0,
  departurePoint: "泉岳寺",
  destinationPoint: "京急泉岳寺駅",
  flightSpeed: 30,
  flightAltitude: 50,
  flyRoute: "{}",
  riskMitigationOnsiteControl: true,
};

const mockApiClient = (): DipsApiClient =>
  ({
    fetchPermissions: vi.fn(),
    notifyFlightPlan: vi.fn(),
    fetchAircraftList: vi.fn(),
    searchFlightProhibitedAreas: vi.fn(),
    searchFlightPlans: vi.fn(),
  }) as unknown as DipsApiClient;

const makeAircraftInfo = (overrides: Partial<DipsAircraftInfo> = {}): DipsAircraftInfo => ({
  regSymbol: "DUMMY0000001",
  serialNumber: "MANUFACT01",
  manufactureCategory: 1,
  uaType: 1,
  makerNameJa: "サンプル製造者01",
  modelNameJa: "サンプル型式01",
  makerNameEn: "Sample Maker 01",
  modelNameEn: "Sample Model 01",
  weightKg: 1.5,
  maxTakeoffWeightKg: 2.0,
  uaStatus: 1,
  deregistrationReason: null,
  deregistrationReasonOther: null,
  remoteIdType: 1,
  validPeriodStart: "2025-06-20T00:00:00+09:00",
  validPeriodEnd: "2028-06-19T00:00:00+09:00",
  ownerCategory: 1,
  userCategory: "1",
  ...overrides,
});

const mockOidcClient = (): DipsOidcClient =>
  ({
    buildAuthorizationUrl: vi.fn(),
    exchangeCodeAndStore: vi.fn(),
    unlinkAccount: vi.fn(),
  }) as unknown as DipsOidcClient;

const mockAircraftService = (): AircraftService =>
  ({ findById: vi.fn() }) as unknown as AircraftService;

const mockFlightPlanService = (): FlightPlanService =>
  ({ findById: vi.fn(), recordDipsNotification: vi.fn() }) as unknown as FlightPlanService;

const context = { userId: "user-1", isAdmin: false };

describe("DipsService", () => {
  let apiClient: DipsApiClient;
  let oidcClient: DipsOidcClient;
  let aircraftService: AircraftService;
  let flightPlanService: FlightPlanService;
  let service: DipsService;

  beforeEach(() => {
    apiClient = mockApiClient();
    oidcClient = mockOidcClient();
    aircraftService = mockAircraftService();
    flightPlanService = mockFlightPlanService();
    service = new DipsService(apiClient, oidcClient, aircraftService, flightPlanService);
  });

  // ─── 認可 ───────────────────────────────────────────────────────────────────

  describe("buildAuthorizationUrl", () => {
    it("test_buildAuthorizationUrl_returns_oidc_client_url", () => {
      vi.mocked(oidcClient.buildAuthorizationUrl).mockReturnValue("https://auth.example/login");

      const url = service.buildAuthorizationUrl("fpl", "state-1");

      expect(url).toBe("https://auth.example/login");
    });

    it("test_buildAuthorizationUrl_passes_realm_and_state_to_oidc_client", () => {
      vi.mocked(oidcClient.buildAuthorizationUrl).mockReturnValue("https://auth.example/login");

      service.buildAuthorizationUrl("fpl", "state-1");

      expect(oidcClient.buildAuthorizationUrl).toHaveBeenCalledWith("fpl", "state-1");
    });
  });

  describe("completeAuthorization", () => {
    it("test_completeAuthorization_exchanges_code_for_tokens", async () => {
      vi.mocked(oidcClient.exchangeCodeAndStore).mockResolvedValue(undefined);

      await service.completeAuthorization("user-1", "fpl", "auth-code");

      expect(oidcClient.exchangeCodeAndStore).toHaveBeenCalledWith("user-1", "fpl", "auth-code");
    });
  });

  // ─── notifyFlightPlan ────────────────────────────────────────────────────────

  describe("notifyFlightPlan", () => {
    it("test_notify_maps_plan_name_to_payload", async () => {
      vi.mocked(flightPlanService.findById).mockResolvedValue(makePlan());
      vi.mocked(aircraftService.findById).mockResolvedValue(makeAircraft());
      vi.mocked(apiClient.notifyFlightPlan).mockResolvedValue({
        flightPlanId: "FP-1",
        flightPlanRegistrationResult: "OK",
        flightPlanRegistrationDatetime: "2026/07/03 10:00",
      });

      await service.notifyFlightPlan("plan-1", userInput, context);

      const payload = vi.mocked(apiClient.notifyFlightPlan).mock.calls[0][1];
      expect(payload.flightPlanInfo.name).toBe("訓練飛行");
    });

    it("test_notify_maps_registration_symbol_to_payload", async () => {
      vi.mocked(flightPlanService.findById).mockResolvedValue(makePlan());
      vi.mocked(aircraftService.findById).mockResolvedValue(makeAircraft());
      vi.mocked(apiClient.notifyFlightPlan).mockResolvedValue({
        flightPlanId: "FP-1",
        flightPlanRegistrationResult: "OK",
        flightPlanRegistrationDatetime: "2026/07/03 10:00",
      });

      await service.notifyFlightPlan("plan-1", userInput, context);

      const payload = vi.mocked(apiClient.notifyFlightPlan).mock.calls[0][1];
      expect(payload.flightPlanInfo.aircraftInfo[0].symbol).toBe("JU1234567890");
    });

    it("test_notify_clamps_flight_minutes_to_five_minute_units", async () => {
      vi.mocked(flightPlanService.findById).mockResolvedValue(makePlan({ durationMin: 7 }));
      vi.mocked(aircraftService.findById).mockResolvedValue(makeAircraft({ maxFlightTimeMin: 22 }));
      vi.mocked(apiClient.notifyFlightPlan).mockResolvedValue({
        flightPlanId: "FP-1",
        flightPlanRegistrationResult: "OK",
        flightPlanRegistrationDatetime: "2026/07/03 10:00",
      });

      await service.notifyFlightPlan("plan-1", userInput, context);

      const payload = vi.mocked(apiClient.notifyFlightPlan).mock.calls[0][1];
      expect({
        plannedMaxTime: payload.flightPlanInfo.plannedMaxTime,
        plannedFlightTime: payload.flightPlanInfo.plannedFlightTime,
      }).toEqual({ plannedMaxTime: 25, plannedFlightTime: 10 });
    });

    it("test_notify_formats_start_time_in_jst", async () => {
      vi.mocked(flightPlanService.findById).mockResolvedValue(makePlan());
      vi.mocked(aircraftService.findById).mockResolvedValue(makeAircraft());
      vi.mocked(apiClient.notifyFlightPlan).mockResolvedValue({
        flightPlanId: "FP-1",
        flightPlanRegistrationResult: "OK",
        flightPlanRegistrationDatetime: "2026/07/03 10:00",
      });

      await service.notifyFlightPlan("plan-1", userInput, context);

      const payload = vi.mocked(apiClient.notifyFlightPlan).mock.calls[0][1];
      expect(payload.flightPlanInfo.startTime).toBe("20260703 1000");
    });

    it("test_notify_returns_result", async () => {
      vi.mocked(flightPlanService.findById).mockResolvedValue(makePlan());
      vi.mocked(aircraftService.findById).mockResolvedValue(makeAircraft());
      vi.mocked(apiClient.notifyFlightPlan).mockResolvedValue({
        flightPlanId: "FP-1",
        flightPlanRegistrationResult: "OK",
        flightPlanRegistrationDatetime: "2026/07/03 10:00",
      });

      const result = await service.notifyFlightPlan("plan-1", userInput, context);

      expect(result.flightPlanId).toBe("FP-1");
    });

    it("test_notify_records_dips_flight_plan_id_after_success", async () => {
      vi.mocked(flightPlanService.findById).mockResolvedValue(makePlan());
      vi.mocked(aircraftService.findById).mockResolvedValue(makeAircraft());
      vi.mocked(apiClient.notifyFlightPlan).mockResolvedValue({
        flightPlanId: "FP-1",
        flightPlanRegistrationResult: "OK",
        flightPlanRegistrationDatetime: "2026/07/03 10:00",
      });

      await service.notifyFlightPlan("plan-1", userInput, context);

      expect(flightPlanService.recordDipsNotification).toHaveBeenCalledWith(
        "plan-1",
        "FP-1",
        context
      );
    });

    it("test_notify_throws_BusinessError_when_already_notified", async () => {
      vi.mocked(flightPlanService.findById).mockResolvedValue(
        makePlan({ dipsFlightPlanId: "FP-existing" })
      );

      await expect(service.notifyFlightPlan("plan-1", userInput, context)).rejects.toThrow(
        BusinessError
      );
    });

    it("test_notify_skips_api_call_when_already_notified", async () => {
      vi.mocked(flightPlanService.findById).mockResolvedValue(
        makePlan({ dipsFlightPlanId: "FP-existing" })
      );

      await service.notifyFlightPlan("plan-1", userInput, context).catch(() => {});

      expect(apiClient.notifyFlightPlan).not.toHaveBeenCalled();
    });

    it("test_notify_throws_BusinessError_when_registration_number_missing", async () => {
      vi.mocked(flightPlanService.findById).mockResolvedValue(makePlan());
      vi.mocked(aircraftService.findById).mockResolvedValue(
        makeAircraft({ registrationNumber: null })
      );

      await expect(service.notifyFlightPlan("plan-1", userInput, context)).rejects.toThrow(
        BusinessError
      );
    });

    it("test_notify_skips_api_call_when_registration_number_missing", async () => {
      vi.mocked(flightPlanService.findById).mockResolvedValue(makePlan());
      vi.mocked(aircraftService.findById).mockResolvedValue(
        makeAircraft({ registrationNumber: null })
      );

      await service.notifyFlightPlan("plan-1", userInput, context).catch(() => {});

      expect(apiClient.notifyFlightPlan).not.toHaveBeenCalled();
    });

    it("test_notify_propagates_not_found_for_unowned_plan", async () => {
      vi.mocked(flightPlanService.findById).mockRejectedValue(
        new FlightPlanNotFoundError("plan-1")
      );

      await expect(service.notifyFlightPlan("plan-1", userInput, context)).rejects.toThrow(
        FlightPlanNotFoundError
      );
    });
  });

  // ─── unlinkAccount ───────────────────────────────────────────────────────────

  describe("unlinkAccount", () => {
    it("test_unlinkAccount_delegates_to_oidc_client_with_given_user_and_realm", async () => {
      vi.mocked(oidcClient.unlinkAccount).mockResolvedValue(undefined);

      await service.unlinkAccount("user-1", "utm");

      expect(oidcClient.unlinkAccount).toHaveBeenCalledWith("user-1", "utm");
    });

    it("test_unlinkAccount_only_targets_the_given_userId_not_a_different_one", async () => {
      // 「他ユーザーのトークンを解除できない」制約は、この関数が受け取った userId
      // だけをそのまま oidcClient に渡すことで担保される (別の userId にすり替わらない)
      vi.mocked(oidcClient.unlinkAccount).mockResolvedValue(undefined);

      await service.unlinkAccount("user-2", "utm");

      expect(oidcClient.unlinkAccount).not.toHaveBeenCalledWith("user-1", "utm");
      expect(oidcClient.unlinkAccount).toHaveBeenCalledWith("user-2", "utm");
    });

    it("test_unlinkAccount_does_not_affect_other_realms", async () => {
      // realm 単位の削除であることを、渡す realm がそのまま1つだけ oidcClient に
      // 届くことで確認する (utm 解除呼び出しで fpl/req が呼ばれないこと)
      vi.mocked(oidcClient.unlinkAccount).mockResolvedValue(undefined);

      await service.unlinkAccount("user-1", "utm");

      expect(oidcClient.unlinkAccount).toHaveBeenCalledTimes(1);
      expect(oidcClient.unlinkAccount).toHaveBeenCalledWith("user-1", "utm");
    });

    it("test_unlinkAccount_resolves_when_oidc_client_reports_no_token_deleted", async () => {
      // 未連携状態でも oidcClient 側は例外を投げない (冪等) 前提で、Service もそのまま解決する
      vi.mocked(oidcClient.unlinkAccount).mockResolvedValue(undefined);

      await expect(service.unlinkAccount("user-1", "utm")).resolves.toBeUndefined();
    });
  });

  // ─── fetchPermissions ────────────────────────────────────────────────────────

  describe("fetchPermissions", () => {
    it("test_fetchPermissions_delegates_to_api_client", async () => {
      // 正規化 (寛容パース・エントリ単位のフォールバック) は DipsApiClient 側
      // (lib/dips/permissionsSchema.ts) の責務のため、Service は結果をそのまま返すだけで
      // よい (このテストは apiClient をモックしているため実際の正規化は経由しない)
      const response = { permissions: [], excludedCount: 0 };
      vi.mocked(apiClient.fetchPermissions).mockResolvedValue(response);

      const result = await service.fetchPermissions("user-1");

      expect(result).toEqual(response);
      expect(apiClient.fetchPermissions).toHaveBeenCalledWith("user-1");
    });
  });

  // ─── searchFlightPlans ───────────────────────────────────────────────────────

  describe("searchFlightPlans", () => {
    it("test_maps_flat_form_input_into_circle_feature_and_all_flight_plan_flag", async () => {
      const response = { flightPlans: [], excludedCount: 0 };
      vi.mocked(apiClient.searchFlightPlans).mockResolvedValue(response);

      const result = await service.searchFlightPlans("user-1", {
        centerLongitude: 139.4677,
        centerLatitude: 35.6476,
        radiusMeters: 10000,
        onlyMine: true,
      });

      expect(result).toEqual(response);
      expect(apiClient.searchFlightPlans).toHaveBeenCalledWith("user-1", {
        features: { type: "Circle", center: [139.4677, 35.6476], radius: 10000 },
        allFlightPlan: "1",
      });
    });

    it("test_defaults_to_all_users_search_when_only_mine_is_omitted", async () => {
      vi.mocked(apiClient.searchFlightPlans).mockResolvedValue({
        flightPlans: [],
        excludedCount: 0,
      });

      await service.searchFlightPlans("user-1", {
        centerLongitude: 139.4677,
        centerLatitude: 35.6476,
        radiusMeters: 10000,
      });

      expect(apiClient.searchFlightPlans).toHaveBeenCalledWith(
        "user-1",
        expect.objectContaining({ allFlightPlan: "0" })
      );
    });
  });

  // ─── searchFlightProhibitedAreas ────────────────────────────────────────────

  describe("searchFlightProhibitedAreas", () => {
    it("test_maps_flat_form_input_into_circle_feature_and_area_type_ids", async () => {
      const response = { areas: [], excludedCount: 0 };
      vi.mocked(apiClient.searchFlightProhibitedAreas).mockResolvedValue(response);

      const result = await service.searchFlightProhibitedAreas("user-1", {
        centerLongitude: 139.7686,
        centerLatitude: 35.6803,
        radiusMeters: 1000,
        flightProhibitedAreaTypeIds: [5, 6],
      });

      expect(result).toEqual(response);
      expect(apiClient.searchFlightProhibitedAreas).toHaveBeenCalledWith("user-1", {
        features: { type: "Circle", center: [139.7686, 35.6803], radius: 1000 },
        flightProhibitedAreaTypeIds: [5, 6],
      });
    });
  });

  // ─── listOwnedAircrafts ──────────────────────────────────────────────────────

  describe("listOwnedAircrafts", () => {
    it("test_listOwnedAircrafts_returns_only_active_aircrafts_by_default", async () => {
      vi.mocked(apiClient.fetchAircraftList).mockResolvedValue({
        aircrafts: [
          makeAircraftInfo({ regSymbol: "JU0000000001", uaStatus: 1 }),
          makeAircraftInfo({ regSymbol: "JU0000000002", uaStatus: 3 }),
        ],
        excludedCount: 0,
      });

      const result = await service.listOwnedAircrafts("user-1");

      expect(result.aircrafts.map((a) => a.registrationCode)).toEqual(["JU0000000001"]);
    });

    it("test_listOwnedAircrafts_includes_invalid_aircrafts_when_option_is_set", async () => {
      vi.mocked(apiClient.fetchAircraftList).mockResolvedValue({
        aircrafts: [
          makeAircraftInfo({ regSymbol: "JU0000000001", uaStatus: 1 }),
          makeAircraftInfo({ regSymbol: "JU0000000002", uaStatus: 3 }),
        ],
        excludedCount: 0,
      });

      const result = await service.listOwnedAircrafts("user-1", { includeInvalid: true });

      expect(result.aircrafts.map((a) => a.registrationCode)).toEqual([
        "JU0000000001",
        "JU0000000002",
      ]);
    });

    it("test_listOwnedAircrafts_sorts_by_registration_code_ascending", async () => {
      vi.mocked(apiClient.fetchAircraftList).mockResolvedValue({
        aircrafts: [
          makeAircraftInfo({ regSymbol: "JU9999999999", uaStatus: 1 }),
          makeAircraftInfo({ regSymbol: "JU1111111111", uaStatus: 1 }),
        ],
        excludedCount: 0,
      });

      const result = await service.listOwnedAircrafts("user-1");

      expect(result.aircrafts.map((a) => a.registrationCode)).toEqual([
        "JU1111111111",
        "JU9999999999",
      ]);
    });

    it("test_listOwnedAircrafts_returns_empty_array_when_account_owns_none", async () => {
      vi.mocked(apiClient.fetchAircraftList).mockResolvedValue({ aircrafts: [], excludedCount: 0 });

      const result = await service.listOwnedAircrafts("user-1");

      expect(result.aircrafts).toEqual([]);
    });

    it("test_listOwnedAircrafts_converts_weight_kg_to_grams", async () => {
      vi.mocked(apiClient.fetchAircraftList).mockResolvedValue({
        aircrafts: [makeAircraftInfo({ weightKg: 24.0001 })],
        excludedCount: 0,
      });

      const result = await service.listOwnedAircrafts("user-1");

      expect(result.aircrafts[0].weightGrams).toBe(24000);
    });

    it("test_listOwnedAircrafts_keeps_weight_grams_null_when_weight_kg_is_null", async () => {
      // 回帰テスト (修正2 の null 寛容化): 重量が数値化できなかった機体は、捏造の 0g では
      // なく null のまま DTO に伝える
      vi.mocked(apiClient.fetchAircraftList).mockResolvedValue({
        aircrafts: [makeAircraftInfo({ weightKg: null })],
        excludedCount: 0,
      });

      const result = await service.listOwnedAircrafts("user-1");

      expect(result.aircrafts[0].weightGrams).toBeNull();
    });

    it("test_listOwnedAircrafts_maps_model_name_ja_to_model_number", async () => {
      vi.mocked(apiClient.fetchAircraftList).mockResolvedValue({
        aircrafts: [makeAircraftInfo({ modelNameJa: "型式X" })],
        excludedCount: 0,
      });

      const result = await service.listOwnedAircrafts("user-1");

      expect(result.aircrafts[0].modelNumber).toBe("型式X");
    });

    it("test_listOwnedAircrafts_maps_manufacturing_number_to_serial_number", async () => {
      vi.mocked(apiClient.fetchAircraftList).mockResolvedValue({
        aircrafts: [makeAircraftInfo({ serialNumber: "MANUFACT000000000003" })],
        excludedCount: 0,
      });

      const result = await service.listOwnedAircrafts("user-1");

      expect(result.aircrafts[0].serialNumber).toBe("MANUFACT000000000003");
    });

    it("test_listOwnedAircrafts_marks_expired_when_status_is_2", async () => {
      vi.mocked(apiClient.fetchAircraftList).mockResolvedValue({
        aircrafts: [makeAircraftInfo({ uaStatus: 2 })],
        excludedCount: 0,
      });

      const result = await service.listOwnedAircrafts("user-1", { includeInvalid: true });

      expect({
        status: result.aircrafts[0].status,
        isSelectable: result.aircrafts[0].isSelectable,
      }).toEqual({
        status: 2,
        isSelectable: false,
      });
    });

    it("test_listOwnedAircrafts_treats_null_status_as_not_selectable", async () => {
      // 回帰テスト (修正2 の null 寛容化): aircraft_status が数値化できなかった機体は
      // 「有効」と誤認させないよう選択不可として扱う
      vi.mocked(apiClient.fetchAircraftList).mockResolvedValue({
        aircrafts: [makeAircraftInfo({ uaStatus: null })],
        excludedCount: 0,
      });

      const result = await service.listOwnedAircrafts("user-1", { includeInvalid: true });

      expect(result.aircrafts[0].isSelectable).toBe(false);
    });

    it("test_listOwnedAircrafts_propagates_excluded_count_from_api_client", async () => {
      // C3 回帰テスト: パースに失敗して除外された機体の件数を上位層 (API レスポンス →
      // UI) まで伝搬させる
      vi.mocked(apiClient.fetchAircraftList).mockResolvedValue({
        aircrafts: [makeAircraftInfo()],
        excludedCount: 3,
      });

      const result = await service.listOwnedAircrafts("user-1");

      expect(result.excludedCount).toBe(3);
    });

    it("test_listOwnedAircrafts_propagates_auth_required_error", async () => {
      vi.mocked(apiClient.fetchAircraftList).mockRejectedValue(new DipsAuthRequiredError("utm"));

      await expect(service.listOwnedAircrafts("user-1")).rejects.toThrow(DipsAuthRequiredError);
    });
  });
});
