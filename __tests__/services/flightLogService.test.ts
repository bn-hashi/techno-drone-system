import { describe, it, expect, vi, beforeEach } from "vitest";
import { FlightLogService } from "@/services/flightLogService";
import type {
  IFlightLogRepository,
  FlightLogWithInspections,
  CreateInspectionInput,
} from "@/repositories/flightLogRepository";
import type { AircraftService } from "@/services/aircraftService";
import type { FlightPlanService } from "@/services/flightPlanService";
import {
  FlightLogNotFoundError,
  FlightPlanNotFoundError,
  AircraftNotFoundError,
  BusinessError,
} from "@/services/errors";
import type { Aircraft, FlightLog } from "@prisma/client";
import { InspectionPhase, InspectionResult } from "@prisma/client";

const makeLog = (overrides: Partial<FlightLog> = {}): FlightLog => ({
  id: "log-1",
  userId: "user-1",
  aircraftId: "aircraft-1",
  flightPlanId: null,
  startedAt: new Date("2026-07-02T10:00:00+09:00"),
  endedAt: new Date("2026-07-02T10:30:00+09:00"),
  durationMin: 30,
  location: "東京都港区",
  pilotNote: null,
  incidentNote: null,
  createdAt: new Date("2026-07-02"),
  updatedAt: new Date("2026-07-02"),
  ...overrides,
});

const makeLogWithInspections = (overrides: Partial<FlightLog> = {}): FlightLogWithInspections => ({
  ...makeLog(overrides),
  inspections: [
    {
      id: "insp-1",
      flightLogId: "log-1",
      phase: InspectionPhase.PRE_FLIGHT,
      itemKey: "battery",
      result: InspectionResult.PASS,
      note: null,
      createdAt: new Date("2026-07-02"),
    },
  ],
});

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
    registrationNumber: null,
    isActive: true,
    createdAt: new Date("2026-07-01"),
    updatedAt: new Date("2026-07-01"),
    ...overrides,
  }) as Aircraft;

const mockRepo = (): IFlightLogRepository => ({
  findAllByUser: vi.fn(),
  findAll: vi.fn(),
  findById: vi.fn(),
  findByIdForPdf: vi.fn(),
  createWithInspections: vi.fn(),
});

const makeLogForPdf = (overrides: Partial<FlightLog> = {}) => ({
  ...makeLogWithInspections(overrides),
  user: { name: "操縦者 太郎" },
  aircraft: {
    name: "テスト機体",
    manufacturer: "テストメーカー",
    registrationNumber: "JU1234567890",
  },
  flightPlan: null,
});

const mockAircraftService = (): AircraftService =>
  ({ findById: vi.fn() }) as unknown as AircraftService;

const mockFlightPlanService = (): FlightPlanService =>
  ({ findById: vi.fn() }) as unknown as FlightPlanService;

const validInspections: CreateInspectionInput[] = [
  { phase: InspectionPhase.PRE_FLIGHT, itemKey: "battery", result: InspectionResult.PASS },
  { phase: InspectionPhase.POST_FLIGHT, itemKey: "propeller", result: InspectionResult.PASS },
];

describe("FlightLogService", () => {
  let repo: IFlightLogRepository;
  let aircraftService: AircraftService;
  let flightPlanService: FlightPlanService;
  let service: FlightLogService;

  beforeEach(() => {
    repo = mockRepo();
    aircraftService = mockAircraftService();
    flightPlanService = mockFlightPlanService();
    service = new FlightLogService(repo, aircraftService, flightPlanService);
  });

  // ─── list ───────────────────────────────────────────────────────────────────

  describe("list", () => {
    it("test_list_pilot_calls_findAllByUser_with_default_pagination", async () => {
      vi.mocked(repo.findAllByUser).mockResolvedValue({ items: [makeLog()], total: 1 });

      await service.list({ userId: "user-1", isAdmin: false });

      expect(repo.findAllByUser).toHaveBeenCalledWith("user-1", { page: 1, limit: 20 });
    });

    it("test_list_admin_calls_findAll", async () => {
      vi.mocked(repo.findAll).mockResolvedValue({ items: [makeLog()], total: 1 });

      await service.list({ userId: "admin-1", isAdmin: true });

      expect(repo.findAll).toHaveBeenCalledWith({ page: 1, limit: 20 });
    });

    it("test_list_returns_logs_total_page_limit", async () => {
      const log = makeLog();
      vi.mocked(repo.findAllByUser).mockResolvedValue({ items: [log], total: 42 });

      const result = await service.list({ userId: "user-1", isAdmin: false });

      expect(result).toEqual({ logs: [log], total: 42, page: 1, limit: 20 });
    });

    it("test_list_clamps_limit_above_max_to_max", async () => {
      vi.mocked(repo.findAllByUser).mockResolvedValue({ items: [], total: 0 });

      await service.list({ userId: "user-1", isAdmin: false }, { limit: 500 });

      expect(repo.findAllByUser).toHaveBeenCalledWith("user-1", { page: 1, limit: 100 });
    });
  });

  // ─── findById ────────────────────────────────────────────────────────────────

  describe("findById", () => {
    it("test_findById_returns_log_with_inspections_when_owner", async () => {
      const log = makeLogWithInspections();
      vi.mocked(repo.findById).mockResolvedValue(log);

      const result = await service.findById("log-1", { userId: "user-1", isAdmin: false });

      expect(result).toEqual(log);
    });

    it("test_findById_returns_log_for_admin", async () => {
      const log = makeLogWithInspections({ userId: "other-user" });
      vi.mocked(repo.findById).mockResolvedValue(log);

      const result = await service.findById("log-1", { userId: "admin-1", isAdmin: true });

      expect(result).toEqual(log);
    });

    it("test_findById_throws_when_not_found", async () => {
      vi.mocked(repo.findById).mockResolvedValue(null);

      await expect(service.findById("log-1", { userId: "user-1", isAdmin: false })).rejects.toThrow(
        FlightLogNotFoundError
      );
    });

    it("test_findById_throws_when_not_owner_and_not_admin", async () => {
      const log = makeLogWithInspections({ userId: "other-user" });
      vi.mocked(repo.findById).mockResolvedValue(log);

      await expect(service.findById("log-1", { userId: "user-1", isAdmin: false })).rejects.toThrow(
        FlightLogNotFoundError
      );
    });
  });

  // ─── findByIdForPdf ──────────────────────────────────────────────────────────

  describe("findByIdForPdf", () => {
    it("test_findByIdForPdf_returns_log_with_relations_when_owner", async () => {
      const log = makeLogForPdf();
      vi.mocked(repo.findByIdForPdf).mockResolvedValue(log);

      const result = await service.findByIdForPdf("log-1", { userId: "user-1", isAdmin: false });

      expect(result).toEqual(log);
    });

    it("test_findByIdForPdf_throws_when_not_found", async () => {
      vi.mocked(repo.findByIdForPdf).mockResolvedValue(null);

      await expect(
        service.findByIdForPdf("log-1", { userId: "user-1", isAdmin: false })
      ).rejects.toThrow(FlightLogNotFoundError);
    });

    it("test_findByIdForPdf_throws_when_not_owner_and_not_admin", async () => {
      const log = makeLogForPdf({ userId: "other-user" });
      vi.mocked(repo.findByIdForPdf).mockResolvedValue(log);

      await expect(
        service.findByIdForPdf("log-1", { userId: "user-1", isAdmin: false })
      ).rejects.toThrow(FlightLogNotFoundError);
    });
  });

  // ─── create ──────────────────────────────────────────────────────────────────

  describe("create", () => {
    const validInput = {
      userId: "user-1",
      aircraftId: "aircraft-1",
      flightPlanId: null,
      startedAt: new Date("2026-07-02T10:00:00+09:00"),
      endedAt: new Date("2026-07-02T10:30:00+09:00"),
      location: "東京都港区",
      pilotNote: null,
      incidentNote: null,
    };
    const context = { userId: "user-1", isAdmin: false };

    it("test_create_computes_durationMin_and_calls_repo", async () => {
      vi.mocked(aircraftService.findById).mockResolvedValue(makeAircraft());
      vi.mocked(repo.createWithInspections).mockResolvedValue(makeLogWithInspections());

      await service.create(validInput, validInspections, context);

      expect(repo.createWithInspections).toHaveBeenCalledWith(
        { ...validInput, durationMin: 30 },
        validInspections
      );
    });

    it("test_create_returns_created_log", async () => {
      const log = makeLogWithInspections();
      vi.mocked(aircraftService.findById).mockResolvedValue(makeAircraft());
      vi.mocked(repo.createWithInspections).mockResolvedValue(log);

      const result = await service.create(validInput, validInspections, context);

      expect(result).toEqual(log);
    });

    it("test_create_checks_aircraft_ownership_with_context", async () => {
      vi.mocked(aircraftService.findById).mockResolvedValue(makeAircraft());
      vi.mocked(repo.createWithInspections).mockResolvedValue(makeLogWithInspections());

      await service.create(validInput, validInspections, context);

      expect(aircraftService.findById).toHaveBeenCalledWith("aircraft-1", context);
    });

    it("test_create_throws_when_aircraft_not_owned", async () => {
      vi.mocked(aircraftService.findById).mockRejectedValue(
        new AircraftNotFoundError("aircraft-1")
      );

      await expect(service.create(validInput, validInspections, context)).rejects.toThrow(
        AircraftNotFoundError
      );
    });

    it("test_create_skips_repo_when_aircraft_not_owned", async () => {
      vi.mocked(aircraftService.findById).mockRejectedValue(
        new AircraftNotFoundError("aircraft-1")
      );

      await expect(service.create(validInput, validInspections, context)).rejects.toThrow(
        AircraftNotFoundError
      );
      expect(repo.createWithInspections).not.toHaveBeenCalled();
    });

    it("test_create_trims_location_before_persisting", async () => {
      vi.mocked(aircraftService.findById).mockResolvedValue(makeAircraft());
      vi.mocked(repo.createWithInspections).mockResolvedValue(makeLogWithInspections());

      await service.create(
        { ...validInput, location: "  東京都港区  " },
        validInspections,
        context
      );

      expect(repo.createWithInspections).toHaveBeenCalledWith(
        expect.objectContaining({ location: "東京都港区" }),
        validInspections
      );
    });

    it("test_create_verifies_flight_plan_when_flightPlanId_given", async () => {
      vi.mocked(aircraftService.findById).mockResolvedValue(makeAircraft());
      vi.mocked(repo.createWithInspections).mockResolvedValue(makeLogWithInspections());

      await service.create({ ...validInput, flightPlanId: "plan-1" }, validInspections, context);

      expect(flightPlanService.findById).toHaveBeenCalledWith("plan-1", context);
    });

    it("test_create_skips_flight_plan_check_when_flightPlanId_null", async () => {
      vi.mocked(aircraftService.findById).mockResolvedValue(makeAircraft());
      vi.mocked(repo.createWithInspections).mockResolvedValue(makeLogWithInspections());

      await service.create(validInput, validInspections, context);

      expect(flightPlanService.findById).not.toHaveBeenCalled();
    });

    it("test_create_throws_when_flight_plan_not_found", async () => {
      vi.mocked(aircraftService.findById).mockResolvedValue(makeAircraft());
      vi.mocked(flightPlanService.findById).mockRejectedValue(
        new FlightPlanNotFoundError("plan-1")
      );

      await expect(
        service.create({ ...validInput, flightPlanId: "plan-1" }, validInspections, context)
      ).rejects.toThrow(FlightPlanNotFoundError);
    });

    it("test_create_skips_repo_when_flight_plan_not_found", async () => {
      vi.mocked(aircraftService.findById).mockResolvedValue(makeAircraft());
      vi.mocked(flightPlanService.findById).mockRejectedValue(
        new FlightPlanNotFoundError("plan-1")
      );

      await expect(
        service.create({ ...validInput, flightPlanId: "plan-1" }, validInspections, context)
      ).rejects.toThrow(FlightPlanNotFoundError);
      expect(repo.createWithInspections).not.toHaveBeenCalled();
    });

    it("test_create_throws_when_endedAt_not_after_startedAt", async () => {
      await expect(
        service.create(
          { ...validInput, endedAt: new Date("2026-07-02T10:00:00+09:00") },
          validInspections,
          context
        )
      ).rejects.toThrow(BusinessError);
    });

    it("test_create_skips_aircraft_check_when_endedAt_not_after_startedAt", async () => {
      await expect(
        service.create(
          { ...validInput, endedAt: new Date("2026-07-02T10:00:00+09:00") },
          validInspections,
          context
        )
      ).rejects.toThrow(BusinessError);
      expect(aircraftService.findById).not.toHaveBeenCalled();
    });

    it("test_create_throws_when_location_is_empty", async () => {
      await expect(
        service.create({ ...validInput, location: "  " }, validInspections, context)
      ).rejects.toThrow(BusinessError);
    });

    it("test_create_throws_when_inspections_empty", async () => {
      await expect(service.create(validInput, [], context)).rejects.toThrow(BusinessError);
    });

    it("test_create_skips_repo_when_inspections_empty", async () => {
      await expect(service.create(validInput, [], context)).rejects.toThrow(BusinessError);
      expect(repo.createWithInspections).not.toHaveBeenCalled();
    });
  });
});
