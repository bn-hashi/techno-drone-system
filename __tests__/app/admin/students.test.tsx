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
import AdminStudentsPage from "@/app/admin/students/page";

const mockListUsers = vi.fn();

const adminSession = {
  user: { id: "admin-1", role: UserRole.ADMIN, status: UserStatus.ACTIVE },
};

const makeStudent = (overrides: Partial<Record<string, unknown>> = {}) => ({
  id: "student-1",
  email: "student@example.com",
  name: "田中太郎",
  role: UserRole.STUDENT,
  status: UserStatus.ACTIVE,
  courseType: CourseType.BEGINNER,
  createdAt: new Date("2025-01-15"),
  updatedAt: new Date("2025-01-15"),
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

describe("AdminStudentsPage", () => {
  it("test_unauthenticated_redirects_to_login", async () => {
    vi.mocked(getServerSession).mockResolvedValue(null);

    await expect(AdminStudentsPage()).rejects.toThrow("NEXT_REDIRECT:/login");
  });

  it("test_unauthenticated_calls_redirect_to_login", async () => {
    vi.mocked(getServerSession).mockResolvedValue(null);

    await AdminStudentsPage().catch(() => {});

    expect(redirect).toHaveBeenCalledWith("/login");
  });

  it("test_unauthenticated_does_not_call_list_users", async () => {
    vi.mocked(getServerSession).mockResolvedValue(null);

    await AdminStudentsPage().catch(() => {});

    expect(mockListUsers).not.toHaveBeenCalled();
  });

  it("test_non_admin_role_redirects_to_login", async () => {
    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: "u-1", role: UserRole.STUDENT, status: UserStatus.ACTIVE },
    });

    await expect(AdminStudentsPage()).rejects.toThrow("NEXT_REDIRECT:/login");
  });

  it("test_calls_listUsers_with_student_role_filter", async () => {
    vi.mocked(getServerSession).mockResolvedValue(adminSession);
    mockListUsers.mockResolvedValue([]);

    await AdminStudentsPage();

    expect(mockListUsers).toHaveBeenCalledWith({ role: UserRole.STUDENT });
  });

  it("test_admin_shows_student_name", async () => {
    vi.mocked(getServerSession).mockResolvedValue(adminSession);
    mockListUsers.mockResolvedValue([makeStudent()]);

    const page = await AdminStudentsPage();
    render(page as React.ReactElement);

    expect(screen.getByText("田中太郎")).toBeInTheDocument();
  });

  it("test_admin_shows_student_email", async () => {
    vi.mocked(getServerSession).mockResolvedValue(adminSession);
    mockListUsers.mockResolvedValue([makeStudent()]);

    const page = await AdminStudentsPage();
    render(page as React.ReactElement);

    expect(screen.getByText("student@example.com")).toBeInTheDocument();
  });

  it("test_admin_shows_student_status_label", async () => {
    vi.mocked(getServerSession).mockResolvedValue(adminSession);
    mockListUsers.mockResolvedValue([makeStudent({ status: UserStatus.EXAM_PASSED })]);

    const page = await AdminStudentsPage();
    render(page as React.ReactElement);

    expect(screen.getByText("試験合格")).toBeInTheDocument();
  });

  it("test_admin_detail_link_points_to_student_page", async () => {
    vi.mocked(getServerSession).mockResolvedValue(adminSession);
    mockListUsers.mockResolvedValue([makeStudent({ id: "stu-123" })]);

    const page = await AdminStudentsPage();
    render(page as React.ReactElement);

    expect(screen.getByRole("link", { name: "詳細" })).toHaveAttribute(
      "href",
      "/admin/students/stu-123"
    );
  });

  it("test_admin_shows_multiple_students", async () => {
    vi.mocked(getServerSession).mockResolvedValue(adminSession);
    mockListUsers.mockResolvedValue([
      makeStudent({ id: "stu-1", name: "受講者A" }),
      makeStudent({ id: "stu-2", name: "受講者B" }),
    ]);

    const page = await AdminStudentsPage();
    render(page as React.ReactElement);

    expect(screen.getByText("受講者A")).toBeInTheDocument();
    expect(screen.getByText("受講者B")).toBeInTheDocument();
  });

  it("test_empty_student_list_shows_message", async () => {
    vi.mocked(getServerSession).mockResolvedValue(adminSession);
    mockListUsers.mockResolvedValue([]);

    const page = await AdminStudentsPage();
    render(page as React.ReactElement);

    expect(screen.getByText("受講者が登録されていません。")).toBeInTheDocument();
  });
});
