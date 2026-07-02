import { describe, it, expect, vi, beforeEach } from "vitest";
import { FlightPlanService } from "@/services/flightPlanService";
import type { IFlightPlanRepository } from "@/repositories/flightPlanRepository";
import type { AircraftService } from "@/services/aircraftService";
import {
  FlightPlanNotFoundError,
  FlightPlanInvalidTransitionError,
  AircraftNotFoundError,
} from "@/services/errors";
import type { FlightPlan, Aircraft } from "@prisma/client";
import { FlightPlanStatus } from "@prisma/client";

const makePlan = (overrides: Partial<FlightPlan> = {}): FlightPlan => ({
  id: "plan-1",
  userId: "user-1",
  aircraftId: "aircraft-1",
  title: "テスト飛行",
  location: "東京都港区",
  plannedAt: new Date("2026-07-10T10:00:00Z"),
  durationMin: 30,
  purpose: "点検飛行",
  status: FlightPlanStatus.DRAFT,
  createdAt: new Date("2026-07-01"),
  updatedAt: new Date("2026-07-01"),
  ...overrides,
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

const mockRepo = (): IFlightPlanRepository => ({
  findAllByUser: vi.fn(),
  findAll: vi.fn(),
  findById: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  updateStatus: vi.fn(),
});

const mockAircraftService = (): AircraftService =>
  ({
    findById: vi.fn(),
  }) as unknown as AircraftService;

describe("FlightPlanService", () => {
  let repo: IFlightPlanRepository;
  let aircraftService: AircraftService;
  let service: FlightPlanService;

  beforeEach(() => {
    repo = mockRepo();
    aircraftService = mockAircraftService();
    service = new FlightPlanService(repo, aircraftService);
  });

  // ─── list ───────────────────────────────────────────────────────────────────

  describe("list", () => {
    it("test_list_pilot_calls_findAllByUser", async () => {
      vi.mocked(repo.findAllByUser).mockResolvedValue({ items: [makePlan()], total: 1 });

      await service.list({ userId: "user-1", isAdmin: false });

      expect(repo.findAllByUser).toHaveBeenCalledWith("user-1", { page: 1, limit: 20 });
    });

    it("test_list_admin_calls_findAll", async () => {
      vi.mocked(repo.findAll).mockResolvedValue({ items: [makePlan()], total: 1 });

      await service.list({ userId: "admin-1", isAdmin: true });

      expect(repo.findAll).toHaveBeenCalledWith({ page: 1, limit: 20 });
    });

    it("test_list_returns_plans_total_page_limit", async () => {
      const plan = makePlan();
      vi.mocked(repo.findAllByUser).mockResolvedValue({ items: [plan], total: 42 });

      const result = await service.list({ userId: "user-1", isAdmin: false });

      expect(result).toEqual({ plans: [plan], total: 42, page: 1, limit: 20 });
    });

    it("test_list_clamps_page_below_one_to_one", async () => {
      vi.mocked(repo.findAllByUser).mockResolvedValue({ items: [], total: 0 });

      await service.list({ userId: "user-1", isAdmin: false }, { page: 0 });

      expect(repo.findAllByUser).toHaveBeenCalledWith("user-1", { page: 1, limit: 20 });
    });

    it("test_list_clamps_limit_above_max_to_max", async () => {
      vi.mocked(repo.findAllByUser).mockResolvedValue({ items: [], total: 0 });

      await service.list({ userId: "user-1", isAdmin: false }, { limit: 500 });

      expect(repo.findAllByUser).toHaveBeenCalledWith("user-1", { page: 1, limit: 100 });
    });
  });

  // ─── findById ────────────────────────────────────────────────────────────────

  describe("findById", () => {
    it("test_findById_returns_plan_when_owner", async () => {
      const plan = makePlan();
      vi.mocked(repo.findById).mockResolvedValue(plan);

      const result = await service.findById("plan-1", { userId: "user-1", isAdmin: false });

      expect(result).toEqual(plan);
    });

    it("test_findById_returns_plan_for_admin", async () => {
      const plan = makePlan({ userId: "other-user" });
      vi.mocked(repo.findById).mockResolvedValue(plan);

      const result = await service.findById("plan-1", { userId: "admin-1", isAdmin: true });

      expect(result).toEqual(plan);
    });

    it("test_findById_throws_when_not_found", async () => {
      vi.mocked(repo.findById).mockResolvedValue(null);

      await expect(
        service.findById("plan-1", { userId: "user-1", isAdmin: false })
      ).rejects.toThrow(FlightPlanNotFoundError);
    });

    it("test_findById_throws_when_not_owner_and_not_admin", async () => {
      const plan = makePlan({ userId: "other-user" });
      vi.mocked(repo.findById).mockResolvedValue(plan);

      await expect(
        service.findById("plan-1", { userId: "user-1", isAdmin: false })
      ).rejects.toThrow(FlightPlanNotFoundError);
    });
  });

  // ─── create ──────────────────────────────────────────────────────────────────

  describe("create", () => {
    const validInput = {
      userId: "user-1",
      aircraftId: "aircraft-1",
      title: "テスト飛行",
      location: "東京都港区",
      plannedAt: new Date("2026-07-10T10:00:00Z"),
      durationMin: 30,
      purpose: "点検飛行",
    };
    const context = { userId: "user-1", isAdmin: false };

    it("test_create_calls_repo_create_with_input_when_aircraft_is_owned", async () => {
      const plan = makePlan();
      vi.mocked(aircraftService.findById).mockResolvedValue(makeAircraft());
      vi.mocked(repo.create).mockResolvedValue(plan);

      await service.create(validInput, context);

      expect(aircraftService.findById).toHaveBeenCalledWith("aircraft-1", context);
      expect(repo.create).toHaveBeenCalledWith(validInput);
    });

    it("test_create_returns_created_plan", async () => {
      const plan = makePlan();
      vi.mocked(aircraftService.findById).mockResolvedValue(makeAircraft());
      vi.mocked(repo.create).mockResolvedValue(plan);

      const result = await service.create(validInput, context);

      expect(result).toEqual(plan);
    });

    it("test_create_throws_and_skips_repo_create_when_aircraft_not_owned", async () => {
      vi.mocked(aircraftService.findById).mockRejectedValue(new AircraftNotFoundError("aircraft-1"));

      await expect(service.create(validInput, context)).rejects.toThrow(AircraftNotFoundError);
      expect(repo.create).not.toHaveBeenCalled();
    });

    it("test_create_allows_admin_to_use_any_aircraft", async () => {
      const plan = makePlan();
      const adminContext = { userId: "admin-1", isAdmin: true };
      vi.mocked(aircraftService.findById).mockResolvedValue(makeAircraft({ userId: "other-user" }));
      vi.mocked(repo.create).mockResolvedValue(plan);

      await service.create(validInput, adminContext);

      expect(aircraftService.findById).toHaveBeenCalledWith("aircraft-1", adminContext);
      expect(repo.create).toHaveBeenCalledWith(validInput);
    });

    it("test_create_throws_when_durationMin_is_zero", async () => {
      await expect(
        service.create({ ...validInput, durationMin: 0 }, context)
      ).rejects.toThrow();
      expect(aircraftService.findById).not.toHaveBeenCalled();
    });

    it("test_create_throws_when_title_is_empty", async () => {
      await expect(service.create({ ...validInput, title: "" }, context)).rejects.toThrow();
    });

    it("test_create_throws_when_location_is_empty", async () => {
      await expect(service.create({ ...validInput, location: "" }, context)).rejects.toThrow();
    });
  });

  // ─── getAircraftForPlan ──────────────────────────────────────────────────────

  describe("getAircraftForPlan", () => {
    it("test_getAircraftForPlan_returns_aircraft_when_found", async () => {
      const plan = makePlan();
      const aircraft = makeAircraft();
      vi.mocked(aircraftService.findById).mockResolvedValue(aircraft);

      const result = await service.getAircraftForPlan(plan);

      expect(result).toEqual(aircraft);
      expect(aircraftService.findById).toHaveBeenCalledWith(plan.aircraftId, {
        userId: plan.userId,
        isAdmin: true,
      });
    });

    it("test_getAircraftForPlan_returns_null_when_aircraft_not_found", async () => {
      const plan = makePlan();
      vi.mocked(aircraftService.findById).mockRejectedValue(
        new AircraftNotFoundError(plan.aircraftId)
      );

      const result = await service.getAircraftForPlan(plan);

      expect(result).toBeNull();
    });

    it("test_getAircraftForPlan_rethrows_unexpected_errors", async () => {
      const plan = makePlan();
      vi.mocked(aircraftService.findById).mockRejectedValue(new Error("unexpected"));

      await expect(service.getAircraftForPlan(plan)).rejects.toThrow("unexpected");
    });
  });

  // ─── getRisk ─────────────────────────────────────────────────────────────────

  describe("getRisk", () => {
    it("test_getRisk_returns_risk_info_when_aircraft_found", async () => {
      const plan = makePlan();
      vi.mocked(repo.findById).mockResolvedValue(plan);
      vi.mocked(aircraftService.findById).mockResolvedValue(makeAircraft({ weightGrams: 500 }));

      const result = await service.getRisk("plan-1", { userId: "user-1", isAdmin: false });

      expect(result.hazard.fallDistanceM).toBeGreaterThan(0);
    });

    it("test_getRisk_throws_when_aircraft_not_found", async () => {
      const plan = makePlan();
      vi.mocked(repo.findById).mockResolvedValue(plan);
      vi.mocked(aircraftService.findById).mockRejectedValue(
        new AircraftNotFoundError(plan.aircraftId)
      );

      await expect(
        service.getRisk("plan-1", { userId: "user-1", isAdmin: false })
      ).rejects.toThrow(AircraftNotFoundError);
    });

    it("test_getRisk_throws_when_plan_not_found", async () => {
      vi.mocked(repo.findById).mockResolvedValue(null);

      await expect(
        service.getRisk("plan-1", { userId: "user-1", isAdmin: false })
      ).rejects.toThrow(FlightPlanNotFoundError);
    });
  });

  // ─── updateStatus ────────────────────────────────────────────────────────────

  describe("updateStatus", () => {
    it("test_updateStatus_draft_to_approved_by_admin", async () => {
      const plan = makePlan({ status: FlightPlanStatus.DRAFT });
      const updated = makePlan({ status: FlightPlanStatus.APPROVED });
      vi.mocked(repo.findById).mockResolvedValue(plan);
      vi.mocked(repo.updateStatus).mockResolvedValue(updated);

      const result = await service.updateStatus("plan-1", FlightPlanStatus.APPROVED, {
        userId: "admin-1",
        isAdmin: true,
      });

      expect(result.status).toBe(FlightPlanStatus.APPROVED);
    });

    it("test_updateStatus_approved_to_completed_by_pilot", async () => {
      const plan = makePlan({ status: FlightPlanStatus.APPROVED, userId: "user-1" });
      const updated = makePlan({ status: FlightPlanStatus.COMPLETED });
      vi.mocked(repo.findById).mockResolvedValue(plan);
      vi.mocked(repo.updateStatus).mockResolvedValue(updated);

      const result = await service.updateStatus("plan-1", FlightPlanStatus.COMPLETED, {
        userId: "user-1",
        isAdmin: false,
      });

      expect(result.status).toBe(FlightPlanStatus.COMPLETED);
    });

    it("test_updateStatus_throws_when_pilot_tries_to_approve", async () => {
      const plan = makePlan({ status: FlightPlanStatus.DRAFT, userId: "user-1" });
      vi.mocked(repo.findById).mockResolvedValue(plan);

      await expect(
        service.updateStatus("plan-1", FlightPlanStatus.APPROVED, {
          userId: "user-1",
          isAdmin: false,
        })
      ).rejects.toThrow(FlightPlanInvalidTransitionError);
    });

    it("test_updateStatus_throws_when_completed_plan_updated", async () => {
      const plan = makePlan({ status: FlightPlanStatus.COMPLETED, userId: "user-1" });
      vi.mocked(repo.findById).mockResolvedValue(plan);

      await expect(
        service.updateStatus("plan-1", FlightPlanStatus.APPROVED, {
          userId: "admin-1",
          isAdmin: true,
        })
      ).rejects.toThrow(FlightPlanInvalidTransitionError);
    });

    it("test_updateStatus_throws_when_plan_not_found", async () => {
      vi.mocked(repo.findById).mockResolvedValue(null);

      await expect(
        service.updateStatus("plan-1", FlightPlanStatus.APPROVED, {
          userId: "admin-1",
          isAdmin: true,
        })
      ).rejects.toThrow(FlightPlanNotFoundError);
    });
  });
});
