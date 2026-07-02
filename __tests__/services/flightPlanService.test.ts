import { describe, it, expect, vi, beforeEach } from "vitest";
import { FlightPlanService } from "@/services/flightPlanService";
import type { IFlightPlanRepository } from "@/repositories/flightPlanRepository";
import { FlightPlanNotFoundError, FlightPlanInvalidTransitionError } from "@/services/errors";
import type { FlightPlan } from "@prisma/client";
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

const mockRepo = (): IFlightPlanRepository => ({
  findAllByUser: vi.fn(),
  findAll: vi.fn(),
  findById: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  updateStatus: vi.fn(),
});

describe("FlightPlanService", () => {
  let repo: IFlightPlanRepository;
  let service: FlightPlanService;

  beforeEach(() => {
    repo = mockRepo();
    service = new FlightPlanService(repo);
  });

  // ─── list ───────────────────────────────────────────────────────────────────

  describe("list", () => {
    it("test_list_pilot_calls_findAllByUser", async () => {
      vi.mocked(repo.findAllByUser).mockResolvedValue([makePlan()]);

      await service.list({ userId: "user-1", isAdmin: false });

      expect(repo.findAllByUser).toHaveBeenCalledWith("user-1");
    });

    it("test_list_admin_calls_findAll", async () => {
      vi.mocked(repo.findAll).mockResolvedValue([makePlan()]);

      await service.list({ userId: "admin-1", isAdmin: true });

      expect(repo.findAll).toHaveBeenCalled();
    });

    it("test_list_pilot_returns_plans", async () => {
      const plan = makePlan();
      vi.mocked(repo.findAllByUser).mockResolvedValue([plan]);

      const result = await service.list({ userId: "user-1", isAdmin: false });

      expect(result).toEqual([plan]);
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
        service.findById("plan-1", { userId: "user-1", isAdmin: false }),
      ).rejects.toThrow(FlightPlanNotFoundError);
    });

    it("test_findById_throws_when_not_owner_and_not_admin", async () => {
      const plan = makePlan({ userId: "other-user" });
      vi.mocked(repo.findById).mockResolvedValue(plan);

      await expect(
        service.findById("plan-1", { userId: "user-1", isAdmin: false }),
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

    it("test_create_calls_repo_create_with_input", async () => {
      const plan = makePlan();
      vi.mocked(repo.create).mockResolvedValue(plan);

      await service.create(validInput);

      expect(repo.create).toHaveBeenCalledWith(validInput);
    });

    it("test_create_returns_created_plan", async () => {
      const plan = makePlan();
      vi.mocked(repo.create).mockResolvedValue(plan);

      const result = await service.create(validInput);

      expect(result).toEqual(plan);
    });

    it("test_create_throws_when_durationMin_is_zero", async () => {
      await expect(
        service.create({ ...validInput, durationMin: 0 }),
      ).rejects.toThrow();
    });

    it("test_create_throws_when_title_is_empty", async () => {
      await expect(
        service.create({ ...validInput, title: "" }),
      ).rejects.toThrow();
    });

    it("test_create_throws_when_location_is_empty", async () => {
      await expect(
        service.create({ ...validInput, location: "" }),
      ).rejects.toThrow();
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
        }),
      ).rejects.toThrow(FlightPlanInvalidTransitionError);
    });

    it("test_updateStatus_throws_when_completed_plan_updated", async () => {
      const plan = makePlan({ status: FlightPlanStatus.COMPLETED, userId: "user-1" });
      vi.mocked(repo.findById).mockResolvedValue(plan);

      await expect(
        service.updateStatus("plan-1", FlightPlanStatus.APPROVED, {
          userId: "admin-1",
          isAdmin: true,
        }),
      ).rejects.toThrow(FlightPlanInvalidTransitionError);
    });

    it("test_updateStatus_throws_when_plan_not_found", async () => {
      vi.mocked(repo.findById).mockResolvedValue(null);

      await expect(
        service.updateStatus("plan-1", FlightPlanStatus.APPROVED, {
          userId: "admin-1",
          isAdmin: true,
        }),
      ).rejects.toThrow(FlightPlanNotFoundError);
    });
  });
});
