import { describe, it, expect, beforeEach, vi } from "vitest";
import { SubjectRepository } from "@/repositories/subjectRepository";

const mockFindMany = vi.fn();
const mockFindUnique = vi.fn();
const mockUpdate = vi.fn();

vi.mock("@/lib/db", () => ({
  getPrisma: () => ({
    subject: {
      findMany: mockFindMany,
      findUnique: mockFindUnique,
      update: mockUpdate,
    },
  }),
}));

describe("SubjectRepository", () => {
  let repository: SubjectRepository;

  const mockSubject = {
    id: "subject-1",
    code: "BASIC",
    name: "基本科目",
    requiredMinutesBeginner: 60,
    requiredMinutesExperienced: 30,
  };

  beforeEach(() => {
    mockFindMany.mockReset();
    mockFindUnique.mockReset();
    mockUpdate.mockReset();
    repository = new SubjectRepository();
  });

  describe("findAll", () => {
    it("test_findAll_returns_all_subjects", async () => {
      mockFindMany.mockResolvedValue([mockSubject]);

      const result = await repository.findAll();

      expect(result).toEqual([mockSubject]);
      expect(mockFindMany).toHaveBeenCalledOnce();
    });

    it("test_findAll_returns_empty_array_when_no_subjects", async () => {
      mockFindMany.mockResolvedValue([]);

      const result = await repository.findAll();

      expect(result).toEqual([]);
    });
  });

  describe("findById", () => {
    it("test_findById_existing_id_returns_subject", async () => {
      mockFindUnique.mockResolvedValue(mockSubject);

      const result = await repository.findById("subject-1");

      expect(result).toEqual(mockSubject);
      expect(mockFindUnique).toHaveBeenCalledWith({ where: { id: "subject-1" } });
    });

    it("test_findById_nonexistent_id_returns_null", async () => {
      mockFindUnique.mockResolvedValue(null);

      const result = await repository.findById("nonexistent");

      expect(result).toBeNull();
    });
  });

  describe("updateRequiredMinutes", () => {
    it("test_updateRequiredMinutes_valid_values_returns_updated_subject", async () => {
      const updated = { ...mockSubject, requiredMinutesBeginner: 90, requiredMinutesExperienced: 45 };
      mockUpdate.mockResolvedValue(updated);

      const result = await repository.updateRequiredMinutes("subject-1", 90, 45);

      expect(result).toEqual(updated);
    });

    it("test_updateRequiredMinutes_calls_prisma_with_correct_args", async () => {
      mockUpdate.mockResolvedValue(mockSubject);

      await repository.updateRequiredMinutes("subject-1", 90, 45);

      expect(mockUpdate).toHaveBeenCalledWith({
        where: { id: "subject-1" },
        data: { requiredMinutesBeginner: 90, requiredMinutesExperienced: 45 },
      });
    });
  });
});
