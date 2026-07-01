import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { UserRole, UserStatus, CourseType } from "@/types/prisma";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  }),
}));
vi.mock("next/link", () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("@/lib/serviceFactory", () => ({
  getUserManagementService: vi.fn(),
}));

import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { getUserManagementService } from "@/lib/serviceFactory";
import AdminJudgmentsPage from "@/app/admin/judgments/page";

const mockListUsers = vi.fn();

const adminSession = {
  user: { id: "admin-1", role: UserRole.ADMIN, status: UserStatus.ACTIVE },
};

const makeExamPassedStudent = (overrides: Partial<Record<string, unknown>> = {}) => ({
  id: "student-1",
  email: "student@example.com",
  name: "山田花子",
  role: UserRole.STUDENT,
  status: UserStatus.EXAM_PASSED,
  courseType: CourseType.BEGINNER,
  createdAt: new Date("2025-03-10"),
  updatedAt: new Date("2025-03-10"),
  emailVerified: null,
  image: null,
  ...overrides,
});

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getUserManagementService).mockReturnValue({
    listUsers: mockListUsers,
  } as unknown as ReturnType<typeof getUserManagementService>);
});

afterEach(() => {
  cleanup();
});

describe("AdminJudgmentsPage", () => {
  it("test_unauthenticated_redirects_to_login", async () => {
    vi.mocked(getServerSession).mockResolvedValue(null);

    await expect(AdminJudgmentsPage()).rejects.toThrow("NEXT_REDIRECT:/login");
  });

  it("test_unauthenticated_calls_redirect", async () => {
    vi.mocked(getServerSession).mockResolvedValue(null);

    await AdminJudgmentsPage().catch(() => {});

    expect(redirect).toHaveBeenCalledWith("/login");
  });

  it("test_non_admin_role_redirects_to_login", async () => {
    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: "u-1", role: UserRole.STUDENT, status: UserStatus.ACTIVE },
    });

    await expect(AdminJudgmentsPage()).rejects.toThrow("NEXT_REDIRECT:/login");
  });

  it("test_calls_listUsers_with_student_role_and_exam_passed_filter", async () => {
    vi.mocked(getServerSession).mockResolvedValue(adminSession);
    mockListUsers.mockResolvedValue([]);

    await AdminJudgmentsPage();

    expect(mockListUsers).toHaveBeenCalledWith({
      role: UserRole.STUDENT,
      status: UserStatus.EXAM_PASSED,
    });
  });

  it("test_shows_student_name", async () => {
    vi.mocked(getServerSession).mockResolvedValue(adminSession);
    mockListUsers.mockResolvedValue([makeExamPassedStudent()]);

    const page = await AdminJudgmentsPage();
    render(page as React.ReactElement);

    expect(screen.getByText("山田花子")).toBeInTheDocument();
  });

  it("test_shows_student_email", async () => {
    vi.mocked(getServerSession).mockResolvedValue(adminSession);
    mockListUsers.mockResolvedValue([makeExamPassedStudent()]);

    const page = await AdminJudgmentsPage();
    render(page as React.ReactElement);

    expect(screen.getByText("student@example.com")).toBeInTheDocument();
  });

  it("test_review_link_points_to_review_page", async () => {
    vi.mocked(getServerSession).mockResolvedValue(adminSession);
    mockListUsers.mockResolvedValue([makeExamPassedStudent({ id: "stu-456" })]);

    const page = await AdminJudgmentsPage();
    render(page as React.ReactElement);

    expect(screen.getByRole("link", { name: "判定画面へ" })).toHaveAttribute(
      "href",
      "/admin/students/stu-456/review"
    );
  });

  it("test_shows_multiple_pending_students", async () => {
    vi.mocked(getServerSession).mockResolvedValue(adminSession);
    mockListUsers.mockResolvedValue([
      makeExamPassedStudent({ id: "stu-1", name: "受講者A" }),
      makeExamPassedStudent({ id: "stu-2", name: "受講者B" }),
    ]);

    const page = await AdminJudgmentsPage();
    render(page as React.ReactElement);

    expect(screen.getByText("受講者A")).toBeInTheDocument();
    expect(screen.getByText("受講者B")).toBeInTheDocument();
  });

  it("test_empty_list_shows_no_pending_message", async () => {
    vi.mocked(getServerSession).mockResolvedValue(adminSession);
    mockListUsers.mockResolvedValue([]);

    const page = await AdminJudgmentsPage();
    render(page as React.ReactElement);

    expect(screen.getByText("現在、判定待ちの受講者はいません。")).toBeInTheDocument();
  });
});
