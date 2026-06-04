import { describe, it, expect, beforeEach, vi } from "vitest";
import { UserRole } from "@/types/prisma";
import { SubjectNotFoundError, BusinessError } from "@/services/errors";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/serviceFactory", () => ({ getSubjectService: vi.fn() }));

import { getServerSession } from "next-auth";
import { getSubjectService } from "@/lib/serviceFactory";
import { PATCH } from "@/app/api/admin/subjects/[id]/route";

const mockUpdateRequiredMinutes = vi.fn();

const adminSession = { user: { id: "admin-1", role: UserRole.ADMIN } };

const mockSubject = {
  id: "subject-1",
  code: "BASIC",
  name: "基本科目",
  requiredMinutesBeginner: 60,
  requiredMinutesExperienced: 30,
};

const makeRequest = (body: unknown) =>
  new Request("http://localhost/api/admin/subjects/subject-1", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

const params = { id: "subject-1" };

describe("PATCH /api/admin/subjects/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getSubjectService).mockReturnValue({
      listSubjects: vi.fn(),
      updateRequiredMinutes: mockUpdateRequiredMinutes,
    } as unknown as ReturnType<typeof getSubjectService>);
  });

  it("test_PATCH_unauthenticated_returns_401", async () => {
    vi.mocked(getServerSession).mockResolvedValue(null);

    const response = await PATCH(makeRequest({ beginner: 60, experienced: 30 }), { params });

    expect(response.status).toBe(401);
  });

  it("test_PATCH_student_role_returns_403", async () => {
    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: "u-1", role: UserRole.STUDENT },
    });

    const response = await PATCH(makeRequest({ beginner: 60, experienced: 30 }), { params });

    expect(response.status).toBe(403);
  });

  it("test_PATCH_missing_beginner_returns_400", async () => {
    vi.mocked(getServerSession).mockResolvedValue(adminSession);

    const response = await PATCH(makeRequest({ experienced: 30 }), { params });

    expect(response.status).toBe(400);
  });

  it("test_PATCH_missing_experienced_returns_400", async () => {
    vi.mocked(getServerSession).mockResolvedValue(adminSession);

    const response = await PATCH(makeRequest({ beginner: 60 }), { params });

    expect(response.status).toBe(400);
  });

  it("test_PATCH_non_integer_beginner_returns_400", async () => {
    vi.mocked(getServerSession).mockResolvedValue(adminSession);

    const response = await PATCH(makeRequest({ beginner: "sixty", experienced: 30 }), { params });

    expect(response.status).toBe(400);
  });

  it("test_PATCH_valid_body_returns_200", async () => {
    vi.mocked(getServerSession).mockResolvedValue(adminSession);
    mockUpdateRequiredMinutes.mockResolvedValue(mockSubject);

    const response = await PATCH(makeRequest({ beginner: 60, experienced: 30 }), { params });

    expect(response.status).toBe(200);
  });

  it("test_PATCH_valid_body_returns_subject_in_body", async () => {
    vi.mocked(getServerSession).mockResolvedValue(adminSession);
    mockUpdateRequiredMinutes.mockResolvedValue(mockSubject);

    const response = await PATCH(makeRequest({ beginner: 60, experienced: 30 }), { params });
    const body = await response.json();

    expect(body.subject).toEqual(mockSubject);
  });

  it("test_PATCH_valid_body_calls_service_with_args", async () => {
    vi.mocked(getServerSession).mockResolvedValue(adminSession);
    mockUpdateRequiredMinutes.mockResolvedValue(mockSubject);

    await PATCH(makeRequest({ beginner: 60, experienced: 30 }), { params });

    expect(mockUpdateRequiredMinutes).toHaveBeenCalledWith("subject-1", 60, 30);
  });

  it("test_PATCH_subject_not_found_returns_404", async () => {
    vi.mocked(getServerSession).mockResolvedValue(adminSession);
    mockUpdateRequiredMinutes.mockRejectedValue(new SubjectNotFoundError("subject-1"));

    const response = await PATCH(makeRequest({ beginner: 60, experienced: 30 }), { params });

    expect(response.status).toBe(404);
  });

  it("test_PATCH_negative_minutes_returns_400", async () => {
    vi.mocked(getServerSession).mockResolvedValue(adminSession);
    mockUpdateRequiredMinutes.mockRejectedValue(new BusinessError("必要時間は0以上"));

    const response = await PATCH(makeRequest({ beginner: -1, experienced: 30 }), { params });

    expect(response.status).toBe(400);
  });
});
