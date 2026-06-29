import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { UserRole, UserStatus, CourseType } from "@/types/prisma";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("next/navigation", () => ({
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
}));
vi.mock("next/link", () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("@/lib/serviceFactory", () => ({
  getCourseService: vi.fn(),
  getUserManagementService: vi.fn(),
}));

import { getServerSession } from "next-auth";
import { notFound } from "next/navigation";
import { getCourseService, getUserManagementService } from "@/lib/serviceFactory";
import CoursesPage from "@/app/(student)/courses/page";

const mockListCourses = vi.fn();
const mockGetUserById = vi.fn();

const activeStudentSession = {
  user: { id: "user-1", role: UserRole.STUDENT, status: UserStatus.ACTIVE },
};

const beginnerCourse = { id: "course-beginner", name: "基礎コース", type: CourseType.BEGINNER };
const experiencedCourse = {
  id: "course-exp",
  name: "経験者コース",
  type: CourseType.EXPERIENCED,
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getCourseService).mockReturnValue({
    listCourses: mockListCourses,
  } as unknown as ReturnType<typeof getCourseService>);
  vi.mocked(getUserManagementService).mockReturnValue({
    getUserById: mockGetUserById,
  } as unknown as ReturnType<typeof getUserManagementService>);
});

afterEach(() => {
  cleanup();
});

describe("CoursesPage", () => {
  it("test_page_unauthenticated_throws_error", async () => {
    vi.mocked(getServerSession).mockResolvedValue(null);

    await expect(CoursesPage()).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("test_page_unauthenticated_calls_notFound", async () => {
    vi.mocked(getServerSession).mockResolvedValue(null);

    await CoursesPage().catch(() => {});

    expect(notFound).toHaveBeenCalled();
  });

  it("test_page_admin_role_throws_error", async () => {
    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: "u-1", role: UserRole.ADMIN, status: UserStatus.ACTIVE },
    });

    await expect(CoursesPage()).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("test_page_admin_role_calls_notFound", async () => {
    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: "u-1", role: UserRole.ADMIN, status: UserStatus.ACTIVE },
    });

    await CoursesPage().catch(() => {});

    expect(notFound).toHaveBeenCalled();
  });

  it("test_page_beginner_student_sees_beginner_course", async () => {
    vi.mocked(getServerSession).mockResolvedValue(activeStudentSession);
    mockGetUserById.mockResolvedValue({ id: "user-1", courseType: CourseType.BEGINNER });
    mockListCourses.mockResolvedValue([beginnerCourse, experiencedCourse]);

    const page = await CoursesPage();
    render(page as React.ReactElement);

    expect(screen.getByText("基礎コース")).toBeInTheDocument();
  });

  it("test_page_beginner_student_does_not_see_experienced_course", async () => {
    vi.mocked(getServerSession).mockResolvedValue(activeStudentSession);
    mockGetUserById.mockResolvedValue({ id: "user-1", courseType: CourseType.BEGINNER });
    mockListCourses.mockResolvedValue([beginnerCourse, experiencedCourse]);

    const page = await CoursesPage();
    render(page as React.ReactElement);

    expect(screen.queryByText("経験者コース")).not.toBeInTheDocument();
  });

  it("test_page_beginner_student_course_link_points_to_course_detail", async () => {
    vi.mocked(getServerSession).mockResolvedValue(activeStudentSession);
    mockGetUserById.mockResolvedValue({ id: "user-1", courseType: CourseType.BEGINNER });
    mockListCourses.mockResolvedValue([beginnerCourse]);

    const page = await CoursesPage();
    render(page as React.ReactElement);

    expect(screen.getByRole("link", { name: "基礎コース" })).toHaveAttribute(
      "href",
      "/courses/course-beginner"
    );
  });

  it("test_page_null_courseType_student_does_not_see_beginner_course", async () => {
    vi.mocked(getServerSession).mockResolvedValue(activeStudentSession);
    mockGetUserById.mockResolvedValue({ id: "user-1", courseType: null });
    mockListCourses.mockResolvedValue([beginnerCourse, experiencedCourse]);

    const page = await CoursesPage();
    render(page as React.ReactElement);

    expect(screen.queryByText("基礎コース")).not.toBeInTheDocument();
  });

  it("test_page_null_courseType_student_does_not_see_experienced_course", async () => {
    vi.mocked(getServerSession).mockResolvedValue(activeStudentSession);
    mockGetUserById.mockResolvedValue({ id: "user-1", courseType: null });
    mockListCourses.mockResolvedValue([beginnerCourse, experiencedCourse]);

    const page = await CoursesPage();
    render(page as React.ReactElement);

    expect(screen.queryByText("経験者コース")).not.toBeInTheDocument();
  });

  it("test_page_inactive_student_throws_error", async () => {
    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: "u-1", role: UserRole.STUDENT, status: UserStatus.PENDING_ACTIVATION },
    });

    await expect(CoursesPage()).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("test_page_inactive_student_calls_notFound", async () => {
    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: "u-1", role: UserRole.STUDENT, status: UserStatus.PENDING_ACTIVATION },
    });

    await CoursesPage().catch(() => {});

    expect(notFound).toHaveBeenCalled();
  });

  it("test_page_does_not_call_listCourses_when_unauthenticated", async () => {
    vi.mocked(getServerSession).mockResolvedValue(null);

    await CoursesPage().catch(() => {});

    expect(mockListCourses).not.toHaveBeenCalled();
  });
});
