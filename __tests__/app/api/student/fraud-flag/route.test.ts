import { describe, it, expect, beforeEach, vi } from "vitest";
import { UserRole, UserStatus } from "@/types/prisma";
import { BusinessError } from "@/services/errors";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/serviceFactory", () => ({ getFraudFlagService: vi.fn() }));

import { getServerSession } from "next-auth";
import { getFraudFlagService } from "@/lib/serviceFactory";
import { POST } from "@/app/api/student/fraud-flag/route";

const mockFlagTabLeave = vi.fn();

const activeStudentSession = {
  user: { id: "user-1", role: UserRole.STUDENT, status: UserStatus.ACTIVE },
};

const makeRequest = (body: unknown) =>
  new Request("http://localhost/api/student/fraud-flag", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getFraudFlagService).mockReturnValue({
    flagTabLeave: mockFlagTabLeave,
  } as unknown as ReturnType<typeof getFraudFlagService>);
});

describe("POST /api/student/fraud-flag", () => {
  it("test_POST_unauthenticated_returns_401", async () => {
    vi.mocked(getServerSession).mockResolvedValue(null);

    const response = await POST(makeRequest({ type: "TAB_LEAVE", durationSeconds: 65 }));

    expect(response.status).toBe(401);
  });

  it("test_POST_admin_role_returns_403", async () => {
    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: "u-1", role: UserRole.ADMIN, status: UserStatus.ACTIVE },
    });

    const response = await POST(makeRequest({ type: "TAB_LEAVE", durationSeconds: 65 }));

    expect(response.status).toBe(403);
  });

  it("test_POST_unknown_type_returns_400", async () => {
    vi.mocked(getServerSession).mockResolvedValue(activeStudentSession);

    const response = await POST(makeRequest({ type: "UNKNOWN", durationSeconds: 65 }));

    expect(response.status).toBe(400);
  });

  it("test_POST_invalid_durationSeconds_returns_400", async () => {
    vi.mocked(getServerSession).mockResolvedValue(activeStudentSession);

    const response = await POST(makeRequest({ type: "TAB_LEAVE", durationSeconds: "abc" }));

    expect(response.status).toBe(400);
  });

  it("test_POST_business_error_returns_400", async () => {
    vi.mocked(getServerSession).mockResolvedValue(activeStudentSession);
    mockFlagTabLeave.mockRejectedValue(new BusinessError("invalid"));

    const response = await POST(makeRequest({ type: "TAB_LEAVE", durationSeconds: 65 }));

    expect(response.status).toBe(400);
  });

  it("test_POST_tab_leave_valid_body_returns_201", async () => {
    vi.mocked(getServerSession).mockResolvedValue(activeStudentSession);
    mockFlagTabLeave.mockResolvedValue({ id: "flag-1" });

    const response = await POST(makeRequest({ type: "TAB_LEAVE", durationSeconds: 65 }));

    expect(response.status).toBe(201);
  });

  it("test_POST_tab_leave_passes_userId_and_duration_to_service", async () => {
    vi.mocked(getServerSession).mockResolvedValue(activeStudentSession);
    mockFlagTabLeave.mockResolvedValue({ id: "flag-1" });

    await POST(makeRequest({ type: "TAB_LEAVE", durationSeconds: 65 }));

    expect(mockFlagTabLeave).toHaveBeenCalledWith("user-1", 65);
  });
});
