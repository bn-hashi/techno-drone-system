import { describe, it, expect, beforeEach, vi } from "vitest";
import { UserRole } from "@/types/prisma";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/serviceFactory", () => ({ getSubjectService: vi.fn() }));

import { getServerSession } from "next-auth";
import { getSubjectService } from "@/lib/serviceFactory";
import { GET } from "@/app/api/admin/subjects/route";

const mockListSubjects = vi.fn();

const adminSession = { user: { id: "admin-1", role: UserRole.ADMIN } };

const mockSubject = {
  id: "subject-1",
  code: "BASIC",
  name: "基本科目",
  requiredMinutesBeginner: 60,
  requiredMinutesExperienced: 30,
};

describe("GET /api/admin/subjects", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getSubjectService).mockReturnValue({
      listSubjects: mockListSubjects,
      updateRequiredMinutes: vi.fn(),
    } as unknown as ReturnType<typeof getSubjectService>);
  });

  it("test_GET_unauthenticated_returns_401", async () => {
    vi.mocked(getServerSession).mockResolvedValue(null);

    const response = await GET();

    expect(response.status).toBe(401);
  });

  it("test_GET_student_role_returns_403", async () => {
    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: "u-1", role: UserRole.STUDENT },
    });

    const response = await GET();

    expect(response.status).toBe(403);
  });

  it("test_GET_admin_returns_200", async () => {
    vi.mocked(getServerSession).mockResolvedValue(adminSession);
    mockListSubjects.mockResolvedValue([mockSubject]);

    const response = await GET();

    expect(response.status).toBe(200);
  });

  it("test_GET_admin_returns_subjects_in_body", async () => {
    vi.mocked(getServerSession).mockResolvedValue(adminSession);
    mockListSubjects.mockResolvedValue([mockSubject]);

    const response = await GET();
    const body = await response.json();

    expect(body.subjects).toHaveLength(1);
  });
});
