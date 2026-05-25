import { describe, it, expect, beforeEach, vi } from "vitest";
import { QARecordRepository } from "@/repositories/qaRecordRepository";

const mockFindUnique = vi.fn();
const mockFindMany = vi.fn();
const mockCreate = vi.fn();
const mockUpdate = vi.fn();

vi.mock("@/lib/db", () => ({
  getPrisma: () => ({
    qARecord: {
      findUnique: mockFindUnique,
      findMany: mockFindMany,
      create: mockCreate,
      update: mockUpdate,
    },
  }),
}));

describe("QARecordRepository", () => {
  let repository: QARecordRepository;

  const baseRecord = {
    id: "qa-1",
    userId: "user-1",
    question: "受講中に不明点があったらどうすればよいですか？",
    answer: null,
    questionedAt: new Date("2026-05-25T00:00:00Z"),
    answeredAt: null,
    answeredBy: null,
  };

  const answeredRecord = {
    ...baseRecord,
    id: "qa-2",
    answer: "本フォームから何度でも質問してください。",
    answeredAt: new Date("2026-05-25T01:00:00Z"),
    answeredBy: "管理者A",
  };

  beforeEach(() => {
    mockFindUnique.mockReset();
    mockFindMany.mockReset();
    mockCreate.mockReset();
    mockUpdate.mockReset();
    repository = new QARecordRepository();
  });

  describe("findById", () => {
    it("test_findById_existing_returns_record", async () => {
      mockFindUnique.mockResolvedValue(baseRecord);

      const result = await repository.findById("qa-1");

      expect(result).toEqual(baseRecord);
    });

    it("test_findById_nonexistent_returns_null", async () => {
      mockFindUnique.mockResolvedValue(null);

      const result = await repository.findById("qa-x");

      expect(result).toBeNull();
    });

    it("test_findById_calls_prisma_with_id", async () => {
      mockFindUnique.mockResolvedValue(null);

      await repository.findById("qa-1");

      expect(mockFindUnique).toHaveBeenCalledWith({ where: { id: "qa-1" } });
    });
  });

  describe("findByUser", () => {
    it("test_findByUser_returns_records_ordered_desc", async () => {
      mockFindMany.mockResolvedValue([answeredRecord, baseRecord]);

      const result = await repository.findByUser("user-1");

      expect(result).toEqual([answeredRecord, baseRecord]);
      expect(mockFindMany).toHaveBeenCalledWith({
        where: { userId: "user-1" },
        orderBy: { questionedAt: "desc" },
      });
    });

    it("test_findByUser_empty_returns_empty_array", async () => {
      mockFindMany.mockResolvedValue([]);

      const result = await repository.findByUser("user-x");

      expect(result).toEqual([]);
    });
  });

  describe("findAllWithUser", () => {
    it("test_findAllWithUser_no_filter_returns_all_records_with_user_select", async () => {
      const withUser = {
        ...baseRecord,
        user: { id: "user-1", name: "山田太郎", email: "y@example.com" },
      };
      mockFindMany.mockResolvedValue([withUser]);

      const result = await repository.findAllWithUser();

      expect(result).toEqual([withUser]);
      expect(mockFindMany).toHaveBeenCalledWith({
        include: { user: { select: { id: true, name: true, email: true } } },
        orderBy: { questionedAt: "desc" },
      });
    });

    it("test_findAllWithUser_unanswered_only_filter_filters_by_null_answer", async () => {
      mockFindMany.mockResolvedValue([]);

      await repository.findAllWithUser({ unansweredOnly: true });

      expect(mockFindMany).toHaveBeenCalledWith({
        where: { answer: null },
        include: { user: { select: { id: true, name: true, email: true } } },
        orderBy: { questionedAt: "desc" },
      });
    });

    it("test_findAllWithUser_unanswered_only_false_returns_all", async () => {
      mockFindMany.mockResolvedValue([]);

      await repository.findAllWithUser({ unansweredOnly: false });

      expect(mockFindMany).toHaveBeenCalledWith({
        include: { user: { select: { id: true, name: true, email: true } } },
        orderBy: { questionedAt: "desc" },
      });
    });
  });

  describe("create", () => {
    it("test_create_persists_question_and_returns_record", async () => {
      mockCreate.mockResolvedValue(baseRecord);

      const result = await repository.create({
        userId: "user-1",
        question: "受講中に不明点があったらどうすればよいですか？",
      });

      expect(result).toEqual(baseRecord);
      expect(mockCreate).toHaveBeenCalledWith({
        data: {
          userId: "user-1",
          question: "受講中に不明点があったらどうすればよいですか？",
        },
      });
    });
  });

  describe("updateAnswer", () => {
    it("test_updateAnswer_sets_answer_answeredAt_answeredBy", async () => {
      mockUpdate.mockResolvedValue(answeredRecord);

      const answeredAt = new Date("2026-05-25T01:00:00Z");
      const result = await repository.updateAnswer("qa-2", {
        answer: "本フォームから何度でも質問してください。",
        answeredAt,
        answeredBy: "管理者A",
      });

      expect(result).toEqual(answeredRecord);
      expect(mockUpdate).toHaveBeenCalledWith({
        where: { id: "qa-2" },
        data: {
          answer: "本フォームから何度でも質問してください。",
          answeredAt,
          answeredBy: "管理者A",
        },
      });
    });
  });
});
