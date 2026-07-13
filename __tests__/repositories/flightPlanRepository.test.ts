import { describe, it, expect, beforeEach, vi } from "vitest";
import { FlightPlanRepository } from "@/repositories/flightPlanRepository";

const mockFindMany = vi.fn();
const mockFindUnique = vi.fn();
const mockCreate = vi.fn();
const mockUpdate = vi.fn();
const mockCount = vi.fn();

vi.mock("@/lib/db", () => ({
  getPrisma: () => ({
    flightPlan: {
      findMany: mockFindMany,
      findUnique: mockFindUnique,
      create: mockCreate,
      update: mockUpdate,
      count: mockCount,
    },
  }),
}));

describe("FlightPlanRepository", () => {
  let repository: FlightPlanRepository;

  const mockPlan = {
    id: "plan-1",
    userId: "user-1",
    aircraftId: "aircraft-1",
    title: "テスト飛行",
    location: "テスト飛行場",
    plannedAt: new Date("2026-08-01T01:00:00Z"),
    durationMin: 30,
    purpose: "訓練",
    status: "DRAFT",
    dipsFlightPlanId: null,
    createdAt: new Date("2026-07-01"),
    updatedAt: new Date("2026-07-01"),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    repository = new FlightPlanRepository();
  });

  describe("findAllByUser", () => {
    it("test_findAllByUser_page2_applies_skip_and_take", async () => {
      mockFindMany.mockResolvedValue([mockPlan]);
      mockCount.mockResolvedValue(15);

      const result = await repository.findAllByUser("user-1", { page: 2, limit: 10 });

      expect(result).toEqual({ items: [mockPlan], total: 15 });
      expect(mockFindMany).toHaveBeenCalledWith({
        where: { userId: "user-1" },
        orderBy: { plannedAt: "desc" },
        skip: 10,
        take: 10,
      });
      expect(mockCount).toHaveBeenCalledWith({ where: { userId: "user-1" } });
    });
  });

  describe("findAll", () => {
    it("test_findAll_page1_has_zero_skip_and_counts_all", async () => {
      mockFindMany.mockResolvedValue([mockPlan]);
      mockCount.mockResolvedValue(1);

      const result = await repository.findAll({ page: 1, limit: 20 });

      expect(result).toEqual({ items: [mockPlan], total: 1 });
      expect(mockFindMany).toHaveBeenCalledWith({
        orderBy: { plannedAt: "desc" },
        skip: 0,
        take: 20,
      });
      expect(mockCount).toHaveBeenCalledWith();
    });
  });

  describe("findById", () => {
    it("test_findById_missing_id_returns_null", async () => {
      mockFindUnique.mockResolvedValue(null);

      const result = await repository.findById("missing");

      expect(result).toBeNull();
      expect(mockFindUnique).toHaveBeenCalledWith({ where: { id: "missing" } });
    });
  });

  describe("create", () => {
    it("test_create_passes_input_to_prisma", async () => {
      mockCreate.mockResolvedValue(mockPlan);
      const input = {
        userId: "user-1",
        aircraftId: "aircraft-1",
        title: "テスト飛行",
        location: "テスト飛行場",
        plannedAt: new Date("2026-08-01T01:00:00Z"),
        durationMin: 30,
        purpose: "訓練",
      };

      const result = await repository.create(input);

      expect(result).toEqual(mockPlan);
      expect(mockCreate).toHaveBeenCalledWith({ data: input });
    });
  });

  describe("update", () => {
    it("test_update_with_status_reverts_plan_to_draft", async () => {
      // Service 層が承認済み計画の編集時に DRAFT へ差し戻すケース
      mockUpdate.mockResolvedValue({ ...mockPlan, title: "更新後", status: "DRAFT" });

      const result = await repository.update("plan-1", { title: "更新後", status: "DRAFT" });

      expect(result.status).toBe("DRAFT");
      expect(mockUpdate).toHaveBeenCalledWith({
        where: { id: "plan-1" },
        data: { title: "更新後", status: "DRAFT" },
      });
    });
  });

  describe("updateStatus", () => {
    it("test_updateStatus_sets_only_status", async () => {
      mockUpdate.mockResolvedValue({ ...mockPlan, status: "APPROVED" });

      const result = await repository.updateStatus("plan-1", "APPROVED");

      expect(result.status).toBe("APPROVED");
      expect(mockUpdate).toHaveBeenCalledWith({
        where: { id: "plan-1" },
        data: { status: "APPROVED" },
      });
    });
  });

  describe("recordDipsNotification", () => {
    it("test_recordDipsNotification_saves_dips_flight_plan_id", async () => {
      mockUpdate.mockResolvedValue({ ...mockPlan, dipsFlightPlanId: "DIPS-001" });

      const result = await repository.recordDipsNotification("plan-1", "DIPS-001");

      expect(result.dipsFlightPlanId).toBe("DIPS-001");
      expect(mockUpdate).toHaveBeenCalledWith({
        where: { id: "plan-1" },
        data: { dipsFlightPlanId: "DIPS-001" },
      });
    });
  });
});
