import { describe, it, expect, vi, beforeEach } from "vitest";
import { DipsService } from "@/services/dipsService";
import type { DipsApiClient } from "@/lib/dips/dipsApiClient";
import type { DipsOidcClient } from "@/lib/dips/oidcClient";
import type { DipsNotificationUserInput } from "@/lib/dips/types";
import type { AircraftService } from "@/services/aircraftService";
import type { FlightPlanService } from "@/services/flightPlanService";
import { FlightPlanNotFoundError, BusinessError } from "@/services/errors";
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
  }) as unknown as DipsApiClient;

const mockOidcClient = (): DipsOidcClient =>
  ({
    buildAuthorizationUrl: vi.fn(),
    exchangeCodeAndStore: vi.fn(),
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

  // ─── fetchPermissions ────────────────────────────────────────────────────────

  describe("fetchPermissions", () => {
    it("test_fetchPermissions_delegates_to_api_client", async () => {
      const response = { permissions: [] };
      vi.mocked(apiClient.fetchPermissions).mockResolvedValue(response);

      const result = await service.fetchPermissions("user-1");

      expect(result).toEqual(response);
      expect(apiClient.fetchPermissions).toHaveBeenCalledWith("user-1");
    });
  });
});
