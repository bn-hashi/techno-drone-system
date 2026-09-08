import { describe, it, expect, vi, beforeEach } from "vitest";
import { AircraftService } from "@/services/aircraftService";
import type { IAircraftRepository } from "@/repositories/aircraftRepository";
import {
  AircraftNotFoundError,
  AircraftDuplicateSerialError,
  BusinessError,
} from "@/services/errors";
import type { Aircraft } from "@prisma/client";

const makeAircraft = (overrides: Partial<Aircraft> = {}): Aircraft => ({
  id: "aircraft-1",
  userId: "user-1",
  name: "DJI Mini 3",
  manufacturer: "DJI",
  modelNumber: "Mini3",
  serialNumber: "SN-001",
  weightGrams: 249,
  maxFlightTimeMin: 38,
  registrationNumber: "JU-001",
  isActive: true,
  createdAt: new Date("2026-06-30"),
  updatedAt: new Date("2026-06-30"),
  dipsUaType: null,
  hasDipsCertification1: false,
  hasDipsCertification2: false,
  dipsCertificationNumber: null,
  maxTakeoffWeightGrams: null,
  ...overrides,
});

const mockRepo = (): IAircraftRepository => ({
  findAllByUser: vi.fn(),
  findAll: vi.fn(),
  findById: vi.fn(),
  findBySerialNumber: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  deactivate: vi.fn(),
});

describe("AircraftService", () => {
  let repo: IAircraftRepository;
  let service: AircraftService;

  beforeEach(() => {
    repo = mockRepo();
    service = new AircraftService(repo);
  });

  describe("list", () => {
    it("test_list_pilot_calls_findAllByUser_with_activeonly_true", async () => {
      const aircraft = makeAircraft();
      vi.mocked(repo.findAllByUser).mockResolvedValue([aircraft]);

      await service.list({ userId: "user-1", isAdmin: false });

      expect(repo.findAllByUser).toHaveBeenCalledWith("user-1", true);
    });

    it("test_list_pilot_returns_one_aircraft", async () => {
      const aircraft = makeAircraft();
      vi.mocked(repo.findAllByUser).mockResolvedValue([aircraft]);

      const result = await service.list({ userId: "user-1", isAdmin: false });

      expect(result).toHaveLength(1);
    });

    it("test_list_pilot_returns_correct_aircraft_id", async () => {
      const aircraft = makeAircraft();
      vi.mocked(repo.findAllByUser).mockResolvedValue([aircraft]);

      const result = await service.list({ userId: "user-1", isAdmin: false });

      expect(result[0].id).toBe("aircraft-1");
    });

    it("test_list_admin_calls_findAll_with_activeonly_true", async () => {
      const aircraft = makeAircraft();
      vi.mocked(repo.findAll).mockResolvedValue([aircraft]);

      await service.list({ userId: "admin-1", isAdmin: true });

      expect(repo.findAll).toHaveBeenCalledWith(true);
    });

    it("test_list_admin_returns_one_aircraft", async () => {
      const aircraft = makeAircraft();
      vi.mocked(repo.findAll).mockResolvedValue([aircraft]);

      const result = await service.list({ userId: "admin-1", isAdmin: true });

      expect(result).toHaveLength(1);
    });

    it("test_list_pilot_calls_findAllByUser_with_activeonly_false", async () => {
      const active = makeAircraft({ id: "a1" });
      const inactive = makeAircraft({ id: "a2", isActive: false });
      vi.mocked(repo.findAllByUser).mockResolvedValue([active, inactive]);

      await service.list({ userId: "user-1", isAdmin: false, activeOnly: false });

      expect(repo.findAllByUser).toHaveBeenCalledWith("user-1", false);
    });

    it("test_list_includes_inactive_when_flag_false", async () => {
      const active = makeAircraft({ id: "a1" });
      const inactive = makeAircraft({ id: "a2", isActive: false });
      vi.mocked(repo.findAllByUser).mockResolvedValue([active, inactive]);

      const result = await service.list({ userId: "user-1", isAdmin: false, activeOnly: false });

      expect(result).toHaveLength(2);
    });
  });

  describe("findById", () => {
    it("test_find_by_id_returns_aircraft_for_owner", async () => {
      const aircraft = makeAircraft();
      vi.mocked(repo.findById).mockResolvedValue(aircraft);

      const result = await service.findById("aircraft-1", { userId: "user-1", isAdmin: false });

      expect(result.id).toBe("aircraft-1");
    });

    it("test_find_by_id_throws_not_found_when_missing", async () => {
      vi.mocked(repo.findById).mockResolvedValue(null);

      await expect(
        service.findById("aircraft-x", { userId: "user-1", isAdmin: false })
      ).rejects.toThrow(AircraftNotFoundError);
    });

    it("test_find_by_id_throws_not_found_when_different_owner", async () => {
      const aircraft = makeAircraft({ userId: "user-2" });
      vi.mocked(repo.findById).mockResolvedValue(aircraft);

      await expect(
        service.findById("aircraft-1", { userId: "user-1", isAdmin: false })
      ).rejects.toThrow(AircraftNotFoundError);
    });

    it("test_find_by_id_admin_can_access_any_aircraft", async () => {
      const aircraft = makeAircraft({ userId: "user-2" });
      vi.mocked(repo.findById).mockResolvedValue(aircraft);

      const result = await service.findById("aircraft-1", { userId: "admin-1", isAdmin: true });

      expect(result.userId).toBe("user-2");
    });
  });

  describe("create", () => {
    it("test_create_returns_new_aircraft", async () => {
      const aircraft = makeAircraft();
      vi.mocked(repo.findBySerialNumber).mockResolvedValue(null);
      vi.mocked(repo.create).mockResolvedValue(aircraft);

      const result = await service.create({
        userId: "user-1",
        name: "DJI Mini 3",
        manufacturer: "DJI",
        modelNumber: "Mini3",
        serialNumber: "SN-001",
        weightGrams: 249,
        maxFlightTimeMin: 38,
        registrationNumber: "JU-001",
      });

      expect(result.serialNumber).toBe("SN-001");
    });

    it("test_create_throws_duplicate_serial_error", async () => {
      vi.mocked(repo.findBySerialNumber).mockResolvedValue(makeAircraft());

      await expect(
        service.create({
          userId: "user-1",
          name: "DJI Mini 3",
          manufacturer: "DJI",
          modelNumber: "Mini3",
          serialNumber: "SN-001",
          weightGrams: 249,
          maxFlightTimeMin: 38,
        })
      ).rejects.toThrow(AircraftDuplicateSerialError);
    });

    it("test_create_rejects_zero_weight_with_business_error", async () => {
      vi.mocked(repo.findBySerialNumber).mockResolvedValue(null);

      await expect(
        service.create({
          userId: "user-1",
          name: "DJI Mini 3",
          manufacturer: "DJI",
          modelNumber: "Mini3",
          serialNumber: "SN-001",
          weightGrams: 0,
          maxFlightTimeMin: 38,
        })
      ).rejects.toThrow(BusinessError);
    });

    it("test_create_rejects_nan_weight_with_business_error", async () => {
      vi.mocked(repo.findBySerialNumber).mockResolvedValue(null);

      await expect(
        service.create({
          userId: "user-1",
          name: "DJI Mini 3",
          manufacturer: "DJI",
          modelNumber: "Mini3",
          serialNumber: "SN-001",
          weightGrams: NaN,
          maxFlightTimeMin: 38,
        })
      ).rejects.toThrow(BusinessError);
    });

    it("test_create_rejects_infinity_weight_with_business_error", async () => {
      vi.mocked(repo.findBySerialNumber).mockResolvedValue(null);

      await expect(
        service.create({
          userId: "user-1",
          name: "DJI Mini 3",
          manufacturer: "DJI",
          modelNumber: "Mini3",
          serialNumber: "SN-001",
          weightGrams: Infinity,
          maxFlightTimeMin: 38,
        })
      ).rejects.toThrow(BusinessError);
    });

    it("test_create_persists_the_dips_ua_type", async () => {
      const aircraft = makeAircraft({ dipsUaType: 3 });
      vi.mocked(repo.findBySerialNumber).mockResolvedValue(null);
      vi.mocked(repo.create).mockResolvedValue(aircraft);

      await service.create({
        userId: "user-1",
        name: "DJI Mini 3",
        manufacturer: "DJI",
        modelNumber: "Mini3",
        serialNumber: "SN-001",
        weightGrams: 249,
        maxFlightTimeMin: 38,
        dipsUaType: 3,
      });

      expect(repo.create).toHaveBeenCalledWith(expect.objectContaining({ dipsUaType: 3 }));
    });

    it("test_create_with_an_out_of_range_dips_ua_type_raises_error", async () => {
      vi.mocked(repo.findBySerialNumber).mockResolvedValue(null);

      await expect(
        service.create({
          userId: "user-1",
          name: "DJI Mini 3",
          manufacturer: "DJI",
          modelNumber: "Mini3",
          serialNumber: "SN-001",
          weightGrams: 249,
          maxFlightTimeMin: 38,
          dipsUaType: 7,
        })
      ).rejects.toThrow(BusinessError);
    });

    it("test_create_with_a_zero_dips_ua_type_raises_error", async () => {
      vi.mocked(repo.findBySerialNumber).mockResolvedValue(null);

      await expect(
        service.create({
          userId: "user-1",
          name: "DJI Mini 3",
          manufacturer: "DJI",
          modelNumber: "Mini3",
          serialNumber: "SN-001",
          weightGrams: 249,
          maxFlightTimeMin: 38,
          dipsUaType: 0,
        })
      ).rejects.toThrow(BusinessError);
    });

    it("test_create_without_a_dips_ua_type_does_not_raise_error", async () => {
      // 機体登録時に未入力でも許可する (DIPS 通報時に別途必須チェックする方針)
      const aircraft = makeAircraft({ dipsUaType: null });
      vi.mocked(repo.findBySerialNumber).mockResolvedValue(null);
      vi.mocked(repo.create).mockResolvedValue(aircraft);

      await expect(
        service.create({
          userId: "user-1",
          name: "DJI Mini 3",
          manufacturer: "DJI",
          modelNumber: "Mini3",
          serialNumber: "SN-001",
          weightGrams: 249,
          maxFlightTimeMin: 38,
        })
      ).resolves.toBe(aircraft);
    });

    it("test_create_rejects_a_zero_max_takeoff_weight_with_business_error", async () => {
      vi.mocked(repo.findBySerialNumber).mockResolvedValue(null);

      await expect(
        service.create({
          userId: "user-1",
          name: "DJI Mini 3",
          manufacturer: "DJI",
          modelNumber: "Mini3",
          serialNumber: "SN-001",
          weightGrams: 249,
          maxFlightTimeMin: 38,
          maxTakeoffWeightGrams: 0,
        })
      ).rejects.toThrow(BusinessError);
    });

    it("test_create_persists_certification_flags_and_certification_number", async () => {
      const aircraft = makeAircraft({
        hasDipsCertification1: true,
        hasDipsCertification2: false,
        dipsCertificationNumber: "12345678901",
      });
      vi.mocked(repo.findBySerialNumber).mockResolvedValue(null);
      vi.mocked(repo.create).mockResolvedValue(aircraft);

      await service.create({
        userId: "user-1",
        name: "DJI Mini 3",
        manufacturer: "DJI",
        modelNumber: "Mini3",
        serialNumber: "SN-001",
        weightGrams: 249,
        maxFlightTimeMin: 38,
        hasDipsCertification1: true,
        hasDipsCertification2: false,
        dipsCertificationNumber: "12345678901",
      });

      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          hasDipsCertification1: true,
          hasDipsCertification2: false,
          dipsCertificationNumber: "12345678901",
        })
      );
    });
  });

  describe("update", () => {
    it("test_update_returns_updated_aircraft", async () => {
      const original = makeAircraft();
      const updated = makeAircraft({ name: "DJI Mini 4" });
      vi.mocked(repo.findById).mockResolvedValue(original);
      vi.mocked(repo.update).mockResolvedValue(updated);

      const result = await service.update(
        "aircraft-1",
        { name: "DJI Mini 4" },
        { userId: "user-1", isAdmin: false }
      );

      expect(result.name).toBe("DJI Mini 4");
    });

    it("test_update_throws_not_found_for_different_owner", async () => {
      const aircraft = makeAircraft({ userId: "user-2" });
      vi.mocked(repo.findById).mockResolvedValue(aircraft);

      await expect(
        service.update("aircraft-1", { name: "X" }, { userId: "user-1", isAdmin: false })
      ).rejects.toThrow(AircraftNotFoundError);
    });

    it("test_update_rejects_weight_zero", async () => {
      const aircraft = makeAircraft();
      vi.mocked(repo.findById).mockResolvedValue(aircraft);

      await expect(
        service.update("aircraft-1", { weightGrams: 0 }, { userId: "user-1", isAdmin: false })
      ).rejects.toThrow(BusinessError);
    });

    it("test_update_rejects_flight_time_zero", async () => {
      const aircraft = makeAircraft();
      vi.mocked(repo.findById).mockResolvedValue(aircraft);

      await expect(
        service.update("aircraft-1", { maxFlightTimeMin: 0 }, { userId: "user-1", isAdmin: false })
      ).rejects.toThrow(BusinessError);
    });

    it("test_update_persists_the_dips_ua_type", async () => {
      const aircraft = makeAircraft();
      vi.mocked(repo.findById).mockResolvedValue(aircraft);
      vi.mocked(repo.update).mockResolvedValue(makeAircraft({ dipsUaType: 2 }));

      await service.update(
        "aircraft-1",
        { dipsUaType: 2 },
        { userId: "user-1", isAdmin: false }
      );

      expect(repo.update).toHaveBeenCalledWith("aircraft-1", { dipsUaType: 2 });
    });

    it("test_update_rejects_an_out_of_range_dips_ua_type", async () => {
      const aircraft = makeAircraft();
      vi.mocked(repo.findById).mockResolvedValue(aircraft);

      await expect(
        service.update("aircraft-1", { dipsUaType: 7 }, { userId: "user-1", isAdmin: false })
      ).rejects.toThrow(BusinessError);
    });

    it("test_update_rejects_a_zero_max_takeoff_weight", async () => {
      const aircraft = makeAircraft();
      vi.mocked(repo.findById).mockResolvedValue(aircraft);

      await expect(
        service.update(
          "aircraft-1",
          { maxTakeoffWeightGrams: 0 },
          { userId: "user-1", isAdmin: false }
        )
      ).rejects.toThrow(BusinessError);
    });

    it("test_update_persists_certification_flags", async () => {
      const aircraft = makeAircraft();
      vi.mocked(repo.findById).mockResolvedValue(aircraft);
      vi.mocked(repo.update).mockResolvedValue(makeAircraft({ hasDipsCertification1: true }));

      await service.update(
        "aircraft-1",
        { hasDipsCertification1: true },
        { userId: "user-1", isAdmin: false }
      );

      expect(repo.update).toHaveBeenCalledWith("aircraft-1", { hasDipsCertification1: true });
    });
  });

  describe("deactivate", () => {
    it("test_deactivate_calls_repo_deactivate_with_aircraft_id", async () => {
      const aircraft = makeAircraft();
      vi.mocked(repo.findById).mockResolvedValue(aircraft);
      vi.mocked(repo.deactivate).mockResolvedValue(makeAircraft({ isActive: false }));

      await service.deactivate("aircraft-1", { userId: "user-1", isAdmin: false });

      expect(repo.deactivate).toHaveBeenCalledWith("aircraft-1");
    });

    it("test_deactivate_returns_deactivated_aircraft", async () => {
      const aircraft = makeAircraft();
      const deactivated = makeAircraft({ isActive: false });
      vi.mocked(repo.findById).mockResolvedValue(aircraft);
      vi.mocked(repo.deactivate).mockResolvedValue(deactivated);

      const result = await service.deactivate("aircraft-1", { userId: "user-1", isAdmin: false });

      expect(result.isActive).toBe(false);
    });

    it("test_deactivate_throws_not_found_for_different_owner", async () => {
      const aircraft = makeAircraft({ userId: "user-2" });
      vi.mocked(repo.findById).mockResolvedValue(aircraft);

      await expect(
        service.deactivate("aircraft-1", { userId: "user-1", isAdmin: false })
      ).rejects.toThrow(AircraftNotFoundError);
    });
  });
});
