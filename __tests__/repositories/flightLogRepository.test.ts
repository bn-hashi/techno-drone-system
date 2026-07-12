import { describe, it, expect, beforeEach, vi } from "vitest";
import { FlightLogRepository } from "@/repositories/flightLogRepository";

const mockFindMany = vi.fn();
const mockFindUnique = vi.fn();
const mockCreate = vi.fn();
const mockCount = vi.fn();

vi.mock("@/lib/db", () => ({
  getPrisma: () => ({
    flightLog: {
      findMany: mockFindMany,
      findUnique: mockFindUnique,
      create: mockCreate,
      count: mockCount,
    },
  }),
}));

// createdAt 同時刻でも順序が安定するよう id を第2ソートキーにする実装仕様
const EXPECTED_INSPECTION_ORDER = [{ createdAt: "asc" }, { id: "asc" }];

describe("FlightLogRepository", () => {
  let repository: FlightLogRepository;

  const mockLog = {
    id: "log-1",
    userId: "user-1",
    aircraftId: "aircraft-1",
    flightPlanId: "plan-1",
    startedAt: new Date("2026-07-01T01:00:00Z"),
    endedAt: new Date("2026-07-01T01:30:00Z"),
    durationMin: 30,
    location: "テスト飛行場",
    pilotNote: null,
    incidentNote: null,
    createdAt: new Date("2026-07-01"),
    updatedAt: new Date("2026-07-01"),
  };

  const mockInspection = {
    id: "inspection-1",
    flightLogId: "log-1",
    phase: "PRE_FLIGHT",
    itemKey: "propeller",
    result: "PASS",
    note: null,
    createdAt: new Date("2026-07-01"),
  };

  const mockLogWithInspections = { ...mockLog, inspections: [mockInspection] };

  beforeEach(() => {
    vi.clearAllMocks();
    repository = new FlightLogRepository();
  });

  describe("findAllByUser", () => {
    it("test_findAllByUser_page2_applies_skip_and_take", async () => {
      mockFindMany.mockResolvedValue([mockLog]);
      mockCount.mockResolvedValue(11);

      const result = await repository.findAllByUser("user-1", { page: 2, limit: 5 });

      expect(result).toEqual({ items: [mockLog], total: 11 });
      expect(mockFindMany).toHaveBeenCalledWith({
        where: { userId: "user-1" },
        orderBy: { startedAt: "desc" },
        skip: 5,
        take: 5,
      });
      expect(mockCount).toHaveBeenCalledWith({ where: { userId: "user-1" } });
    });
  });

  describe("findAll", () => {
    it("test_findAll_counts_all_without_where", async () => {
      mockFindMany.mockResolvedValue([mockLog]);
      mockCount.mockResolvedValue(1);

      const result = await repository.findAll({ page: 1, limit: 20 });

      expect(result.total).toBe(1);
      expect(mockCount).toHaveBeenCalledWith();
    });
  });

  describe("findById", () => {
    it("test_findById_includes_inspections_with_stable_order", async () => {
      mockFindUnique.mockResolvedValue(mockLogWithInspections);

      const result = await repository.findById("log-1");

      expect(result).toEqual(mockLogWithInspections);
      expect(mockFindUnique).toHaveBeenCalledWith({
        where: { id: "log-1" },
        include: { inspections: { orderBy: EXPECTED_INSPECTION_ORDER } },
      });
    });

    it("test_findById_missing_id_returns_null", async () => {
      mockFindUnique.mockResolvedValue(null);

      const result = await repository.findById("missing");

      expect(result).toBeNull();
    });
  });

  describe("findByIdForPdf", () => {
    it("test_findByIdForPdf_includes_user_aircraft_and_plan", async () => {
      const pdfLog = {
        ...mockLogWithInspections,
        user: { name: "テスト操縦者" },
        aircraft: { name: "テスト機体", manufacturer: "DJI", registrationNumber: null },
        flightPlan: { title: "テスト飛行", purpose: "訓練" },
      };
      mockFindUnique.mockResolvedValue(pdfLog);

      const result = await repository.findByIdForPdf("log-1");

      expect(result).toEqual(pdfLog);
      expect(mockFindUnique).toHaveBeenCalledWith({
        where: { id: "log-1" },
        include: {
          inspections: { orderBy: EXPECTED_INSPECTION_ORDER },
          user: { select: { name: true } },
          aircraft: { select: { name: true, manufacturer: true, registrationNumber: true } },
          flightPlan: { select: { title: true, purpose: true } },
        },
      });
    });
  });

  describe("createWithInspections", () => {
    it("test_createWithInspections_creates_log_and_inspections_in_nested_create", async () => {
      mockCreate.mockResolvedValue(mockLogWithInspections);
      const input = {
        userId: "user-1",
        aircraftId: "aircraft-1",
        flightPlanId: "plan-1",
        startedAt: new Date("2026-07-01T01:00:00Z"),
        endedAt: new Date("2026-07-01T01:30:00Z"),
        durationMin: 30,
        location: "テスト飛行場",
      };
      const inspections = [
        { phase: "PRE_FLIGHT" as const, itemKey: "propeller" as const, result: "PASS" as const },
      ];

      const result = await repository.createWithInspections(input, inspections);

      expect(result).toEqual(mockLogWithInspections);
      expect(mockCreate).toHaveBeenCalledWith({
        data: {
          ...input,
          inspections: { create: inspections },
        },
        include: { inspections: { orderBy: EXPECTED_INSPECTION_ORDER } },
      });
    });
  });
});
