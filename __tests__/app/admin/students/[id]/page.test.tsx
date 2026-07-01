import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { UserRole, UserStatus, CourseType } from "@/types/prisma";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  }),
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
  getUserManagementService: vi.fn(),
}));
vi.mock("@/app/admin/students/[id]/InviteButton", () => ({
  InviteButton: ({ studentId }: { studentId: string }) => (
    <button data-testid="invite-button" data-student-id={studentId}>
      招待を送る
    </button>
  ),
}));

import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { getUserManagementService } from "@/lib/serviceFactory";
import StudentDetailPage from "@/app/admin/students/[id]/page";

const mockGetUserById = vi.fn();

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
    getUserById: mockGetUserById,
  } as unknown as ReturnType<typeof getUserManagementService>);
});

afterEach(() => {
  cleanup();
});

describe("StudentDetailPage", () => {
  it("test_unauthenticated_redirects_to_login", async () => {
    vi.mocked(getServerSession).mockResolvedValue(null);

    await expect(StudentDetailPage({ params: { id: "s-1" } })).rejects.toThrow(
      "NEXT_REDIRECT:/login"
    );
  });

  it("test_unauthenticated_does_not_call_getUserById", async () => {
    vi.mocked(getServerSession).mockResolvedValue(null);

    await StudentDetailPage({ params: { id: "s-1" } }).catch(() => {});

    expect(mockGetUserById).not.toHaveBeenCalled();
  });

  it("test_non_admin_role_redirects_to_login", async () => {
    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: "u-1", role: UserRole.STUDENT, status: UserStatus.ACTIVE },
    });

    await expect(StudentDetailPage({ params: { id: "s-1" } })).rejects.toThrow(
      "NEXT_REDIRECT:/login"
    );
  });

  it("test_non_admin_calls_redirect", async () => {
    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: "u-1", role: UserRole.STUDENT, status: UserStatus.ACTIVE },
    });

    await StudentDetailPage({ params: { id: "s-1" } }).catch(() => {});

    expect(redirect).toHaveBeenCalledWith("/login");
  });

  it("test_admin_shows_student_name", async () => {
    vi.mocked(getServerSession).mockResolvedValue(adminSession);
    mockGetUserById.mockResolvedValue(makeStudent());

    const page = await StudentDetailPage({ params: { id: "student-1" } });
    render(page as React.ReactElement);

    expect(screen.getByText("田中太郎")).toBeInTheDocument();
  });

  it("test_admin_shows_student_email", async () => {
    vi.mocked(getServerSession).mockResolvedValue(adminSession);
    mockGetUserById.mockResolvedValue(makeStudent());

    const page = await StudentDetailPage({ params: { id: "student-1" } });
    render(page as React.ReactElement);

    expect(screen.getByText("student@example.com")).toBeInTheDocument();
  });

  it("test_admin_shows_status_label", async () => {
    vi.mocked(getServerSession).mockResolvedValue(adminSession);
    mockGetUserById.mockResolvedValue(makeStudent({ status: UserStatus.EXAM_PASSED }));

    const page = await StudentDetailPage({ params: { id: "student-1" } });
    render(page as React.ReactElement);

    expect(screen.getByText("試験合格")).toBeInTheDocument();
  });

  it("test_not_found_when_student_does_not_exist", async () => {
    vi.mocked(getServerSession).mockResolvedValue(adminSession);
    mockGetUserById.mockResolvedValue(null);

    await expect(StudentDetailPage({ params: { id: "nonexistent" } })).rejects.toThrow(
      "NEXT_NOT_FOUND"
    );
  });
});
