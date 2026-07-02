import { describe, it, expect, vi, beforeEach } from "vitest";
import { DipsService } from "@/services/dipsService";
import type { DipsApiClient } from "@/lib/dips/dipsApiClient";
import type { DipsAircraftInfo } from "@/lib/dips/types";
import type { AircraftService } from "@/services/aircraftService";
import type { FlightPlanService } from "@/services/flightPlanService";
import { AircraftNotFoundError, FlightPlanNotFoundError, BusinessError } from "@/services/errors";
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
    dipsReceptionNumber: null,
    createdAt: new Date("2026-07-01"),
    updatedAt: new Date("2026-07-01"),
    ...overrides,
  }) as FlightPlan;

const makeDipsAircraft = (overrides: Partial<DipsAircraftInfo> = {}): DipsAircraftInfo =>
  ({
    regSymbol: "JU1234567890",
    serialNumber: "SN-1",
    manufactureCategory: 1,
    uaType: 3,
    makerNameJa: "テストメーカー",
    modelNameJa: "テスト機体",
    makerNameEn: "Test Maker",
    modelNameEn: "Test Model",
    weightKg: 0.5,
    maxTakeoffWeightKg: 0.9,
    uaStatus: 1,
    deregistrationReason: null,
    remoteIdType: 1,
    remoteIdBroadcastMethod: 1,
    validPeriodStart: "2026-01-01T00:00:00+09:00",
    validPeriodEnd: "2029-01-01T00:00:00+09:00",
    ...overrides,
  }) as DipsAircraftInfo;

const mockApiClient = (): DipsApiClient =>
  ({
    fetchAircraftList: vi.fn(),
    fetchPermissions: vi.fn(),
    submitPermissionApplication: vi.fn(),
    fetchFlightPlans: vi.fn(),
    fetchNoFlyAreas: vi.fn(),
    notifyFlightPlan: vi.fn(),
  }) as unknown as DipsApiClient;

const mockAircraftService = (): AircraftService =>
  ({ findById: vi.fn() }) as unknown as AircraftService;

const mockFlightPlanService = (): FlightPlanService =>
  ({ findById: vi.fn(), recordDipsNotification: vi.fn() }) as unknown as FlightPlanService;

const context = { userId: "user-1", isAdmin: false };

describe("DipsService", () => {
  let apiClient: DipsApiClient;
  let aircraftService: AircraftService;
  let flightPlanService: FlightPlanService;
  let service: DipsService;

  beforeEach(() => {
    apiClient = mockApiClient();
    aircraftService = mockAircraftService();
    flightPlanService = mockFlightPlanService();
    service = new DipsService(apiClient, aircraftService, flightPlanService);
  });

  // ─── verifyAircraftRegistration ─────────────────────────────────────────────

  describe("verifyAircraftRegistration", () => {
    it("test_verify_returns_registered_when_reg_symbol_matches_active", async () => {
      vi.mocked(aircraftService.findById).mockResolvedValue(makeAircraft());
      vi.mocked(apiClient.fetchAircraftList).mockResolvedValue([makeDipsAircraft()]);

      const result = await service.verifyAircraftRegistration("aircraft-1", context);

      expect(result.isRegistered).toBe(true);
    });

    it("test_verify_returns_matched_aircraft_info", async () => {
      const dipsInfo = makeDipsAircraft();
      vi.mocked(aircraftService.findById).mockResolvedValue(makeAircraft());
      vi.mocked(apiClient.fetchAircraftList).mockResolvedValue([dipsInfo]);

      const result = await service.verifyAircraftRegistration("aircraft-1", context);

      expect(result.aircraftInfo).toEqual(dipsInfo);
    });

    it("test_verify_returns_not_registered_when_no_match", async () => {
      vi.mocked(aircraftService.findById).mockResolvedValue(makeAircraft());
      vi.mocked(apiClient.fetchAircraftList).mockResolvedValue([
        makeDipsAircraft({ regSymbol: "JU0000000000" }),
      ]);

      const result = await service.verifyAircraftRegistration("aircraft-1", context);

      expect(result).toEqual({ isRegistered: false, aircraftInfo: null });
    });

    it("test_verify_returns_not_registered_when_ua_status_inactive", async () => {
      vi.mocked(aircraftService.findById).mockResolvedValue(makeAircraft());
      vi.mocked(apiClient.fetchAircraftList).mockResolvedValue([makeDipsAircraft({ uaStatus: 2 })]);

      const result = await service.verifyAircraftRegistration("aircraft-1", context);

      expect(result.isRegistered).toBe(false);
    });

    it("test_verify_throws_BusinessError_when_registration_number_missing", async () => {
      vi.mocked(aircraftService.findById).mockResolvedValue(
        makeAircraft({ registrationNumber: null })
      );

      await expect(service.verifyAircraftRegistration("aircraft-1", context)).rejects.toThrow(
        BusinessError
      );
    });

    it("test_verify_skips_api_call_when_registration_number_missing", async () => {
      vi.mocked(aircraftService.findById).mockResolvedValue(
        makeAircraft({ registrationNumber: null })
      );

      await expect(service.verifyAircraftRegistration("aircraft-1", context)).rejects.toThrow(
        BusinessError
      );
      expect(apiClient.fetchAircraftList).not.toHaveBeenCalled();
    });

    it("test_verify_propagates_not_found_for_unowned_aircraft", async () => {
      vi.mocked(aircraftService.findById).mockRejectedValue(
        new AircraftNotFoundError("aircraft-1")
      );

      await expect(service.verifyAircraftRegistration("aircraft-1", context)).rejects.toThrow(
        AircraftNotFoundError
      );
    });
  });

  // ─── notifyFlightPlan ────────────────────────────────────────────────────────

  describe("notifyFlightPlan", () => {
    it("test_notify_maps_plan_fields_to_payload", async () => {
      vi.mocked(flightPlanService.findById).mockResolvedValue(makePlan());
      vi.mocked(aircraftService.findById).mockResolvedValue(makeAircraft());
      vi.mocked(apiClient.notifyFlightPlan).mockResolvedValue({
        receptionNumber: "P250700001",
      });

      await service.notifyFlightPlan("plan-1", context);

      expect(apiClient.notifyFlightPlan).toHaveBeenCalledWith({
        flightStartDatetime: "2026-07-03T01:00:00.000Z",
        flightEndDatetime: "2026-07-03T02:00:00.000Z",
        flightPurpose: "操縦訓練",
        flightLocation: "東京都港区",
        regSymbol: "JU1234567890",
      });
    });

    it("test_notify_returns_reception_number", async () => {
      vi.mocked(flightPlanService.findById).mockResolvedValue(makePlan());
      vi.mocked(aircraftService.findById).mockResolvedValue(makeAircraft());
      vi.mocked(apiClient.notifyFlightPlan).mockResolvedValue({
        receptionNumber: "P250700001",
      });

      const result = await service.notifyFlightPlan("plan-1", context);

      expect(result).toEqual({ receptionNumber: "P250700001" });
    });

    it("test_notify_records_reception_number_after_successful_notification", async () => {
      vi.mocked(flightPlanService.findById).mockResolvedValue(makePlan());
      vi.mocked(aircraftService.findById).mockResolvedValue(makeAircraft());
      vi.mocked(apiClient.notifyFlightPlan).mockResolvedValue({
        receptionNumber: "P250700001",
      });

      await service.notifyFlightPlan("plan-1", context);

      expect(flightPlanService.recordDipsNotification).toHaveBeenCalledWith(
        "plan-1",
        "P250700001",
        context
      );
    });

    it("test_notify_throws_BusinessError_when_already_notified", async () => {
      vi.mocked(flightPlanService.findById).mockResolvedValue(
        makePlan({ dipsReceptionNumber: "P250700001" })
      );

      await expect(service.notifyFlightPlan("plan-1", context)).rejects.toThrow(BusinessError);
    });

    it("test_notify_skips_api_call_when_already_notified", async () => {
      vi.mocked(flightPlanService.findById).mockResolvedValue(
        makePlan({ dipsReceptionNumber: "P250700001" })
      );

      await expect(service.notifyFlightPlan("plan-1", context)).rejects.toThrow(BusinessError);
      expect(apiClient.notifyFlightPlan).not.toHaveBeenCalled();
    });

    it("test_notify_throws_BusinessError_when_registration_number_missing", async () => {
      vi.mocked(flightPlanService.findById).mockResolvedValue(makePlan());
      vi.mocked(aircraftService.findById).mockResolvedValue(
        makeAircraft({ registrationNumber: null })
      );

      await expect(service.notifyFlightPlan("plan-1", context)).rejects.toThrow(BusinessError);
    });

    it("test_notify_skips_api_call_when_registration_number_missing", async () => {
      vi.mocked(flightPlanService.findById).mockResolvedValue(makePlan());
      vi.mocked(aircraftService.findById).mockResolvedValue(
        makeAircraft({ registrationNumber: null })
      );

      await expect(service.notifyFlightPlan("plan-1", context)).rejects.toThrow(BusinessError);
      expect(apiClient.notifyFlightPlan).not.toHaveBeenCalled();
    });

    it("test_notify_propagates_not_found_for_unowned_plan", async () => {
      vi.mocked(flightPlanService.findById).mockRejectedValue(
        new FlightPlanNotFoundError("plan-1")
      );

      await expect(service.notifyFlightPlan("plan-1", context)).rejects.toThrow(
        FlightPlanNotFoundError
      );
    });
  });

  // ─── パススルー ───────────────────────────────────────────────────────────────

  describe("fetchPermissions", () => {
    it("test_fetchPermissions_delegates_to_api_client", async () => {
      const response = { permissions: [] };
      vi.mocked(apiClient.fetchPermissions).mockResolvedValue(response);

      const result = await service.fetchPermissions();

      expect(result).toEqual(response);
    });
  });

  describe("fetchNoFlyAreas", () => {
    it("test_fetchNoFlyAreas_delegates_to_api_client", async () => {
      vi.mocked(apiClient.fetchNoFlyAreas).mockResolvedValue([{ areaName: "空港周辺" }]);

      const result = await service.fetchNoFlyAreas();

      expect(result).toEqual([{ areaName: "空港周辺" }]);
    });
  });
});
