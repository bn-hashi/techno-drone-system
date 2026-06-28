import { describe, it, expect, beforeEach, vi, type Mocked } from "vitest";
import { User, Course } from "@prisma/client";
import { UserRole, UserStatus, CourseType } from "@/types/prisma";
import { CourseAccessService } from "@/services/courseAccessService";
import type { IUserRepository } from "@/repositories/userRepository";
import type { ICourseRepository } from "@/repositories/courseRepository";

describe("CourseAccessService", () => {
  let service: CourseAccessService;
  let mockUserRepo: Mocked<IUserRepository>;
  let mockCourseRepo: Mocked<ICourseRepository>;

  const mockBeginnerStudent: User = {
    id: "user-beginner",
    email: "beginner@example.com",
    name: "初学者受講生",
    passwordHash: "$2b$10$hashedpassword",
    role: UserRole.STUDENT,
    status: UserStatus.ACTIVE,
    courseType: CourseType.BEGINNER,
    expiresAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockExperiencedStudent: User = {
    ...mockBeginnerStudent,
    id: "user-experienced",
    email: "experienced@example.com",
    courseType: CourseType.EXPERIENCED,
  };

  const mockBeginnerCourse: Course = {
    id: "course-beginner",
    name: "初学者コース",
    type: CourseType.BEGINNER,
  };

  const mockExperiencedCourse: Course = {
    id: "course-experienced",
    name: "経験者コース",
    type: CourseType.EXPERIENCED,
  };

  beforeEach(() => {
    mockUserRepo = {
      findByEmail: vi.fn(),
      findAll: vi.fn(),
      findById: vi.fn(),
      create: vi.fn(),
      updateStatus: vi.fn(),
      updatePassword: vi.fn(),
    } as Mocked<IUserRepository>;

    mockCourseRepo = {
      findAll: vi.fn(),
      findById: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    } as Mocked<ICourseRepository>;

    service = new CourseAccessService(mockUserRepo, mockCourseRepo);
  });

  describe("canAccessCourse", () => {
    it("test_canAccessCourse_active_beginner_student_beginner_course_returns_true", async () => {
      mockUserRepo.findById.mockResolvedValue(mockBeginnerStudent);
      mockCourseRepo.findById.mockResolvedValue(mockBeginnerCourse);

      const result = await service.canAccessCourse("user-beginner", "course-beginner");

      expect(result).toBe(true);
    });

    it("test_canAccessCourse_active_beginner_student_experienced_course_returns_false", async () => {
      mockUserRepo.findById.mockResolvedValue(mockBeginnerStudent);
      mockCourseRepo.findById.mockResolvedValue(mockExperiencedCourse);

      const result = await service.canAccessCourse("user-beginner", "course-experienced");

      expect(result).toBe(false);
    });

    it("test_canAccessCourse_active_experienced_student_experienced_course_returns_true", async () => {
      mockUserRepo.findById.mockResolvedValue(mockExperiencedStudent);
      mockCourseRepo.findById.mockResolvedValue(mockExperiencedCourse);

      const result = await service.canAccessCourse("user-experienced", "course-experienced");

      expect(result).toBe(true);
    });

    it("test_canAccessCourse_active_experienced_student_beginner_course_returns_false", async () => {
      mockUserRepo.findById.mockResolvedValue(mockExperiencedStudent);
      mockCourseRepo.findById.mockResolvedValue(mockBeginnerCourse);

      const result = await service.canAccessCourse("user-experienced", "course-beginner");

      expect(result).toBe(false);
    });

    it("test_canAccessCourse_user_not_found_returns_false", async () => {
      mockUserRepo.findById.mockResolvedValue(null);

      const result = await service.canAccessCourse("nonexistent-user", "course-beginner");

      expect(result).toBe(false);
    });

    it("test_canAccessCourse_user_not_found_does_not_call_course_repo", async () => {
      mockUserRepo.findById.mockResolvedValue(null);

      await service.canAccessCourse("nonexistent-user", "course-beginner");

      expect(mockCourseRepo.findById).not.toHaveBeenCalled();
    });

    it("test_canAccessCourse_course_not_found_returns_false", async () => {
      mockUserRepo.findById.mockResolvedValue(mockBeginnerStudent);
      mockCourseRepo.findById.mockResolvedValue(null);

      const result = await service.canAccessCourse("user-beginner", "nonexistent-course");

      expect(result).toBe(false);
    });

    it("test_canAccessCourse_user_courseType_null_returns_false", async () => {
      const studentWithNullCourseType: User = {
        ...mockBeginnerStudent,
        courseType: null,
      };
      mockUserRepo.findById.mockResolvedValue(studentWithNullCourseType);

      const result = await service.canAccessCourse("user-beginner", "course-beginner");

      expect(result).toBe(false);
    });

    it("test_canAccessCourse_user_courseType_null_does_not_call_course_repo", async () => {
      const studentWithNullCourseType: User = {
        ...mockBeginnerStudent,
        courseType: null,
      };
      mockUserRepo.findById.mockResolvedValue(studentWithNullCourseType);

      await service.canAccessCourse("user-beginner", "course-beginner");

      expect(mockCourseRepo.findById).not.toHaveBeenCalled();
    });

    it("test_canAccessCourse_student_status_pending_returns_false", async () => {
      const pendingStudent: User = {
        ...mockBeginnerStudent,
        status: UserStatus.PENDING_REGISTRATION,
      };
      mockUserRepo.findById.mockResolvedValue(pendingStudent);

      const result = await service.canAccessCourse("user-beginner", "course-beginner");

      expect(result).toBe(false);
    });

    it("test_canAccessCourse_student_status_pending_does_not_call_course_repo", async () => {
      const pendingStudent: User = {
        ...mockBeginnerStudent,
        status: UserStatus.PENDING_REGISTRATION,
      };
      mockUserRepo.findById.mockResolvedValue(pendingStudent);

      await service.canAccessCourse("user-beginner", "course-beginner");

      expect(mockCourseRepo.findById).not.toHaveBeenCalled();
    });

    it("test_canAccessCourse_student_status_completed_returns_false", async () => {
      const completedStudent: User = {
        ...mockBeginnerStudent,
        status: UserStatus.COMPLETED,
      };
      mockUserRepo.findById.mockResolvedValue(completedStudent);

      const result = await service.canAccessCourse("user-beginner", "course-beginner");

      expect(result).toBe(false);
    });

    it("test_canAccessCourse_admin_user_returns_false", async () => {
      const adminUser: User = {
        ...mockBeginnerStudent,
        id: "user-admin",
        role: UserRole.ADMIN,
        courseType: CourseType.BEGINNER,
      };
      mockUserRepo.findById.mockResolvedValue(adminUser);

      const result = await service.canAccessCourse("user-admin", "course-beginner");

      expect(result).toBe(false);
    });

    it("test_canAccessCourse_admin_user_does_not_call_course_repo", async () => {
      const adminUser: User = {
        ...mockBeginnerStudent,
        id: "user-admin",
        role: UserRole.ADMIN,
        courseType: CourseType.BEGINNER,
      };
      mockUserRepo.findById.mockResolvedValue(adminUser);

      await service.canAccessCourse("user-admin", "course-beginner");

      expect(mockCourseRepo.findById).not.toHaveBeenCalled();
    });

    it("test_canAccessCourse_course_type_null_returns_false", async () => {
      // Course.type will become nullable in M4 when LIMITED_REMOVAL category is added.
      // This test verifies that null (course) === null (if user had null courseType) does not grant access.
      // We cast null to satisfy the current non-null generated type.
      const courseWithNullType: Course = {
        ...mockBeginnerCourse,
        type: null as unknown as CourseType,
      };
      mockUserRepo.findById.mockResolvedValue(mockBeginnerStudent);
      mockCourseRepo.findById.mockResolvedValue(courseWithNullType);

      const result = await service.canAccessCourse("user-beginner", "course-beginner");

      expect(result).toBe(false);
    });

    it("test_canAccessCourse_user_repo_throws_propagates_error", async () => {
      const repoError = new Error("DB connection failed");
      mockUserRepo.findById.mockRejectedValue(repoError);

      await expect(service.canAccessCourse("user-beginner", "course-beginner")).rejects.toThrow(
        "DB connection failed"
      );
    });

    it("test_canAccessCourse_course_repo_throws_propagates_error", async () => {
      mockUserRepo.findById.mockResolvedValue(mockBeginnerStudent);
      const repoError = new Error("DB timeout");
      mockCourseRepo.findById.mockRejectedValue(repoError);

      await expect(service.canAccessCourse("user-beginner", "course-beginner")).rejects.toThrow(
        "DB timeout"
      );
    });
  });
});
