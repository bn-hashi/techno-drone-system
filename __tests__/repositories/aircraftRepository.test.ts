import { describe, it, expect, beforeEach, vi } from "vitest";
import { AircraftRepository } from "@/repositories/aircraftRepository";

const mockFindMany = vi.fn();
const mockFindUnique = vi.fn();
const mockCreate = vi.fn();
const mockUpdate = vi.fn();

vi.mock("@/lib/db", () => ({
  getPrisma: () => ({
    aircraft: {
      findMany: mockFindMany,
      findUnique: mockFindUnique,
      create: mockCreate,
      update: mockUpdate,
    },
  }),
}));

describe("AircraftRepository", () => {
  let repository: AircraftRepository;

  const mockAircraft = {
    id: "aircraft-1",
    userId: "user-1",
    name: "テスト機体",
    manufacturer: "DJI",
    modelNumber: "Mavic 3",
    serialNumber: "SN-0001",
    weightGrams: 895,
    maxFlightTimeMin: 46,
    registrationNumber: "JU1234567890",
    isActive: true,
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01"),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    repository = new AircraftRepository();
  });

  describe("findAllByUser", () => {
    it("test_findAllByUser_with_activeOnly_filters_by_isActive", async () => {
      mockFindMany.mockResolvedValue([mockAircraft]);

      const result = await repository.findAllByUser("user-1", true);

      expect(result).toEqual([mockAircraft]);
      expect(mockFindMany).toHaveBeenCalledWith({
        where: { userId: "user-1", isActive: true },
        orderBy: { createdAt: "desc" },
      });
    });

    it("test_findAllByUser_without_activeOnly_returns_all_of_user", async () => {
      mockFindMany.mockResolvedValue([mockAircraft]);

      await repository.findAllByUser("user-1", false);

      expect(mockFindMany).toHaveBeenCalledWith({
        where: { userId: "user-1" },
        orderBy: { createdAt: "desc" },
      });
    });
  });

  describe("findAll", () => {
    it("test_findAll_with_activeOnly_filters_by_isActive", async () => {
      mockFindMany.mockResolvedValue([mockAircraft]);

      await repository.findAll(true);

      expect(mockFindMany).toHaveBeenCalledWith({
        where: { isActive: true },
        orderBy: { createdAt: "desc" },
      });
    });

    it("test_findAll_without_activeOnly_has_empty_where", async () => {
      mockFindMany.mockResolvedValue([]);

      await repository.findAll(false);

      expect(mockFindMany).toHaveBeenCalledWith({
        where: {},
        orderBy: { createdAt: "desc" },
      });
    });
  });

  describe("findById", () => {
    it("test_findById_existing_id_returns_aircraft", async () => {
      mockFindUnique.mockResolvedValue(mockAircraft);

      const result = await repository.findById("aircraft-1");

      expect(result).toEqual(mockAircraft);
      expect(mockFindUnique).toHaveBeenCalledWith({ where: { id: "aircraft-1" } });
    });

    it("test_findById_missing_id_returns_null", async () => {
      mockFindUnique.mockResolvedValue(null);

      const result = await repository.findById("missing");

      expect(result).toBeNull();
    });
  });

  describe("findBySerialNumber", () => {
    it("test_findBySerialNumber_queries_by_serial_number", async () => {
      mockFindUnique.mockResolvedValue(mockAircraft);

      const result = await repository.findBySerialNumber("SN-0001");

      expect(result).toEqual(mockAircraft);
      expect(mockFindUnique).toHaveBeenCalledWith({ where: { serialNumber: "SN-0001" } });
    });
  });

  describe("create", () => {
    it("test_create_passes_input_to_prisma", async () => {
      mockCreate.mockResolvedValue(mockAircraft);
      const input = {
        userId: "user-1",
        name: "テスト機体",
        manufacturer: "DJI",
        modelNumber: "Mavic 3",
        serialNumber: "SN-0001",
        weightGrams: 895,
        maxFlightTimeMin: 46,
      };

      const result = await repository.create(input);

      expect(result).toEqual(mockAircraft);
      expect(mockCreate).toHaveBeenCalledWith({ data: input });
    });
  });

  describe("update", () => {
    it("test_update_passes_partial_input_to_prisma", async () => {
      mockUpdate.mockResolvedValue({ ...mockAircraft, name: "更新後" });

      const result = await repository.update("aircraft-1", { name: "更新後" });

      expect(result.name).toBe("更新後");
      expect(mockUpdate).toHaveBeenCalledWith({
        where: { id: "aircraft-1" },
        data: { name: "更新後" },
      });
    });
  });

  describe("deactivate", () => {
    it("test_deactivate_sets_isActive_false", async () => {
      mockUpdate.mockResolvedValue({ ...mockAircraft, isActive: false });

      const result = await repository.deactivate("aircraft-1");

      expect(result.isActive).toBe(false);
      expect(mockUpdate).toHaveBeenCalledWith({
        where: { id: "aircraft-1" },
        data: { isActive: false },
      });
    });
  });
});
