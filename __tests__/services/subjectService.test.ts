import { describe, it, expect, beforeEach, vi, type Mocked } from "vitest";
import { SubjectService } from "@/services/subjectService";
import type { ISubjectRepository } from "@/repositories/subjectRepository";
import { SubjectNotFoundError, BusinessError } from "@/services/errors";

describe("SubjectService", () => {
  let service: SubjectService;
  let mockSubjectRepo: Mocked<ISubjectRepository>;

  const mockSubject = {
    id: "subject-1",
    code: "BASIC",
    name: "学科",
    requiredMinutesBeginner: 10,
    requiredMinutesExperienced: 5,
  };

  beforeEach(() => {
    mockSubjectRepo = {
      findAll: vi.fn(),
      findById: vi.fn(),
      updateRequiredMinutes: vi.fn(),
    } as Mocked<ISubjectRepository>;

    service = new SubjectService(mockSubjectRepo);
  });

  describe("listSubjects", () => {
    it("test_listSubjects_returns_all_subjects", async () => {
      mockSubjectRepo.findAll.mockResolvedValue([mockSubject]);

      const result = await service.listSubjects();

      expect(result).toEqual([mockSubject]);
    });

    it("test_listSubjects_calls_repo_findAll_once", async () => {
      mockSubjectRepo.findAll.mockResolvedValue([mockSubject]);

      await service.listSubjects();

      expect(mockSubjectRepo.findAll).toHaveBeenCalledOnce();
    });

    it("test_listSubjects_empty_returns_empty_array", async () => {
      mockSubjectRepo.findAll.mockResolvedValue([]);

      const result = await service.listSubjects();

      expect(result).toEqual([]);
    });
  });

  describe("updateRequiredMinutes", () => {
    it("test_updateRequiredMinutes_subject_not_found_throws_SubjectNotFoundError", async () => {
      mockSubjectRepo.findById.mockResolvedValue(null);

      await expect(service.updateRequiredMinutes("nonexistent", 10, 5)).rejects.toThrow(
        SubjectNotFoundError
      );
    });

    it("test_updateRequiredMinutes_valid_id_returns_updated_subject", async () => {
      const updated = {
        ...mockSubject,
        requiredMinutesBeginner: 20,
        requiredMinutesExperienced: 10,
      };
      mockSubjectRepo.findById.mockResolvedValue(mockSubject);
      mockSubjectRepo.updateRequiredMinutes.mockResolvedValue(updated);

      const result = await service.updateRequiredMinutes("subject-1", 20, 10);

      expect(result).toEqual(updated);
    });

    it("test_updateRequiredMinutes_valid_id_calls_repo_with_args", async () => {
      const updated = {
        ...mockSubject,
        requiredMinutesBeginner: 20,
        requiredMinutesExperienced: 10,
      };
      mockSubjectRepo.findById.mockResolvedValue(mockSubject);
      mockSubjectRepo.updateRequiredMinutes.mockResolvedValue(updated);

      await service.updateRequiredMinutes("subject-1", 20, 10);

      expect(mockSubjectRepo.updateRequiredMinutes).toHaveBeenCalledWith("subject-1", 20, 10);
    });

    it("test_updateRequiredMinutes_negative_beginner_throws_BusinessError", async () => {
      mockSubjectRepo.findById.mockResolvedValue(mockSubject);

      await expect(service.updateRequiredMinutes("subject-1", -1, 5)).rejects.toThrow(
        BusinessError
      );
    });

    it("test_updateRequiredMinutes_negative_experienced_throws_BusinessError", async () => {
      mockSubjectRepo.findById.mockResolvedValue(mockSubject);

      await expect(service.updateRequiredMinutes("subject-1", 10, -1)).rejects.toThrow(
        BusinessError
      );
    });

    it("test_updateRequiredMinutes_zero_beginner_is_valid", async () => {
      const updated = { ...mockSubject, requiredMinutesBeginner: 0, requiredMinutesExperienced: 0 };
      mockSubjectRepo.findById.mockResolvedValue(mockSubject);
      mockSubjectRepo.updateRequiredMinutes.mockResolvedValue(updated);

      const result = await service.updateRequiredMinutes("subject-1", 0, 0);

      expect(result.requiredMinutesBeginner).toBe(0);
    });

    it("test_updateRequiredMinutes_zero_experienced_is_valid", async () => {
      const updated = { ...mockSubject, requiredMinutesBeginner: 0, requiredMinutesExperienced: 0 };
      mockSubjectRepo.findById.mockResolvedValue(mockSubject);
      mockSubjectRepo.updateRequiredMinutes.mockResolvedValue(updated);

      const result = await service.updateRequiredMinutes("subject-1", 0, 0);

      expect(result.requiredMinutesExperienced).toBe(0);
    });
  });
});
