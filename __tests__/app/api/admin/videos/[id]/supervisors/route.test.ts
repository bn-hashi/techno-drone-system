import { describe, it, expect, beforeEach, vi } from "vitest";
import { UserRole } from "@/types/prisma";
import { VideoNotFoundError, BusinessError } from "@/services/errors";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/serviceFactory", () => ({ getVideoService: vi.fn() }));

import { getServerSession } from "next-auth";
import { getVideoService } from "@/lib/serviceFactory";
import { POST } from "@/app/api/admin/videos/[id]/supervisors/route";

const mockAddSupervisor = vi.fn();

const adminSession = { user: { id: "admin-1", role: UserRole.ADMIN } };
const params = { id: "video-1" };

const mockSupervisor = {
  id: "supervisor-1",
  videoId: "video-1",
  name: "山田太郎",
  instructorRegistrationNumber: "REG-001",
};

const makeRequest = (body: unknown) =>
  new Request(`http://localhost/api/admin/videos/${params.id}/supervisors`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

const mockService = () =>
  vi.mocked(getVideoService).mockReturnValue({
    listVideos: vi.fn(),
    getVideo: vi.fn(),
    createVideo: vi.fn(),
    updateVideo: vi.fn(),
    deleteVideo: vi.fn(),
    addSupervisor: mockAddSupervisor,
    updateSupervisor: vi.fn(),
    removeSupervisor: vi.fn(),
  } as unknown as ReturnType<typeof getVideoService>);

describe("POST /api/admin/videos/[id]/supervisors", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockService();
  });

  it("test_POST_unauthenticated_returns_401", async () => {
    vi.mocked(getServerSession).mockResolvedValue(null);

    const response = await POST(
      makeRequest({ name: "山田太郎", instructorRegistrationNumber: "REG-001" }),
      { params }
    );

    expect(response.status).toBe(401);
  });

  it("test_POST_student_role_returns_403", async () => {
    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: "u-1", role: UserRole.STUDENT },
    });

    const response = await POST(
      makeRequest({ name: "山田太郎", instructorRegistrationNumber: "REG-001" }),
      { params }
    );

    expect(response.status).toBe(403);
  });

  it("test_POST_missing_name_returns_400", async () => {
    vi.mocked(getServerSession).mockResolvedValue(adminSession);

    const response = await POST(makeRequest({ instructorRegistrationNumber: "REG-001" }), {
      params,
    });

    expect(response.status).toBe(400);
  });

  it("test_POST_missing_registration_number_returns_400", async () => {
    vi.mocked(getServerSession).mockResolvedValue(adminSession);

    const response = await POST(makeRequest({ name: "山田太郎" }), { params });

    expect(response.status).toBe(400);
  });

  it("test_POST_valid_body_returns_201", async () => {
    vi.mocked(getServerSession).mockResolvedValue(adminSession);
    mockAddSupervisor.mockResolvedValue(mockSupervisor);

    const response = await POST(
      makeRequest({ name: "山田太郎", instructorRegistrationNumber: "REG-001" }),
      { params }
    );

    expect(response.status).toBe(201);
  });

  it("test_POST_valid_body_returns_supervisor_in_body", async () => {
    vi.mocked(getServerSession).mockResolvedValue(adminSession);
    mockAddSupervisor.mockResolvedValue(mockSupervisor);

    const response = await POST(
      makeRequest({ name: "山田太郎", instructorRegistrationNumber: "REG-001" }),
      { params }
    );
    const body = await response.json();

    expect(body.supervisor).toEqual(mockSupervisor);
  });

  it("test_POST_valid_body_calls_service_with_args", async () => {
    vi.mocked(getServerSession).mockResolvedValue(adminSession);
    mockAddSupervisor.mockResolvedValue(mockSupervisor);

    await POST(makeRequest({ name: "山田太郎", instructorRegistrationNumber: "REG-001" }), {
      params,
    });

    expect(mockAddSupervisor).toHaveBeenCalledWith("video-1", {
      name: "山田太郎",
      instructorRegistrationNumber: "REG-001",
    });
  });

  it("test_POST_video_not_found_returns_404", async () => {
    vi.mocked(getServerSession).mockResolvedValue(adminSession);
    mockAddSupervisor.mockRejectedValue(new VideoNotFoundError("video-1"));

    const response = await POST(
      makeRequest({ name: "山田太郎", instructorRegistrationNumber: "REG-001" }),
      { params }
    );

    expect(response.status).toBe(404);
  });

  it("test_POST_business_error_returns_400", async () => {
    vi.mocked(getServerSession).mockResolvedValue(adminSession);
    mockAddSupervisor.mockRejectedValue(new BusinessError("監修者名は必須です"));

    const response = await POST(
      makeRequest({ name: "", instructorRegistrationNumber: "REG-001" }),
      { params }
    );

    expect(response.status).toBe(400);
  });
});
