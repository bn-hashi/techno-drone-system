import { describe, it, expect, beforeEach, vi } from "vitest";
import { SubjectProgressRepository } from "@/repositories/subjectProgressRepository";

const mockFindUnique = vi.fn();
const mockFindMany = vi.fn();
const mockUpsert = vi.fn();

vi.mock("@/lib/db", () => ({
  getPrisma: () => ({
    subjectProgress: {
      findUnique: mockFindUnique,
      findMany: mockFindMany,
      upsert: mockUpsert,
    },
  }),
}));

describe("SubjectProgressRepository", () => {
  let repository: SubjectProgressRepository;

  const mockProgress = {
    id: "progress-1",
    userId: "user-1",
    subjectId: "subject-1",
    totalWatchedMinutes: 30,
    isFulfilled: false,
    updatedAt: new Date(),
  };

  beforeEach(() => {
    mockFindUnique.mockReset();
    mockFindMany.mockReset();
    mockUpsert.mockReset();
    repository = new SubjectProgressRepository();
  });

  describe("findByUserSubject", () => {
    it("test_findByUserSubject_existing_returns_progress", async () => {
      mockFindUnique.mockResolvedValue(mockProgress);

      const result = await repository.findByUserSubject("user-1", "subject-1");

      expect(result).toEqual(mockProgress);
    });

    it("test_findByUserSubject_nonexistent_returns_null", async () => {
      mockFindUnique.mockResolvedValue(null);

      const result = await repository.findByUserSubject("user-1", "subject-x");

      expect(result).toBeNull();
    });

    it("test_findByUserSubject_calls_prisma_with_composite_unique_key", async () => {
      mockFindUnique.mockResolvedValue(null);

      await repository.findByUserSubject("user-1", "subject-1");

      expect(mockFindUnique).toHaveBeenCalledWith({
        where: { userId_subjectId: { userId: "user-1", subjectId: "subject-1" } },
      });
    });
  });

  describe("findAllByUser", () => {
    it("test_findAllByUser_returns_progress_array", async () => {
      mockFindMany.mockResolvedValue([mockProgress]);

      const result = await repository.findAllByUser("user-1");

      expect(result).toEqual([mockProgress]);
    });

    it("test_findAllByUser_calls_prisma_with_userId_filter", async () => {
      mockFindMany.mockResolvedValue([]);

      await repository.findAllByUser("user-1");

      expect(mockFindMany).toHaveBeenCalledWith({
        where: { userId: "user-1" },
      });
    });
  });

  describe("upsert", () => {
    it("test_upsert_returns_progress", async () => {
      mockUpsert.mockResolvedValue(mockProgress);

      const result = await repository.upsert({
        userId: "user-1",
        subjectId: "subject-1",
        totalWatchedMinutes: 30,
        isFulfilled: false,
      });

      expect(result).toEqual(mockProgress);
    });

    it("test_upsert_uses_composite_where_and_create_update_blocks", async () => {
      mockUpsert.mockResolvedValue(mockProgress);

      await repository.upsert({
        userId: "user-1",
        subjectId: "subject-1",
        totalWatchedMinutes: 30,
        isFulfilled: false,
      });

      expect(mockUpsert).toHaveBeenCalledWith({
        where: { userId_subjectId: { userId: "user-1", subjectId: "subject-1" } },
        create: {
          userId: "user-1",
          subjectId: "subject-1",
          totalWatchedMinutes: 30,
          isFulfilled: false,
        },
        update: { totalWatchedMinutes: 30, isFulfilled: false },
      });
    });
  });
});
