import { describe, it, expect, beforeEach, vi } from "vitest";
import { UserRole } from "@/types/prisma";
import { SupervisorNotFoundError, BusinessError } from "@/services/errors";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/serviceFactory", () => ({ getVideoService: vi.fn() }));

import { getServerSession } from "next-auth";
import { getVideoService } from "@/lib/serviceFactory";
import { PATCH, DELETE } from "@/app/api/admin/videos/[id]/supervisors/[supervisorId]/route";

const mockUpdateSupervisor = vi.fn();
const mockRemoveSupervisor = vi.fn();

const adminSession = { user: { id: "admin-1", role: UserRole.ADMIN } };
const params = { id: "video-1", supervisorId: "supervisor-1" };

const mockSupervisor = {
  id: "supervisor-1",
  videoId: "video-1",
  name: "山田太郎",
  instructorRegistrationNumber: "REG-001",
};

const makeRequest = (method: string, body?: unknown) =>
  new Request(
    `http://localhost/api/admin/videos/${params.id}/supervisors/${params.supervisorId}`,
    {
      method,
      headers: { "Content-Type": "application/json" },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    }
  );

const mockService = () =>
  vi.mocked(getVideoService).mockReturnValue({
    listVideos: vi.fn(),
    getVideo: vi.fn(),
    createVideo: vi.fn(),
    updateVideo: vi.fn(),
    deleteVideo: vi.fn(),
    addSupervisor: vi.fn(),
    updateSupervisor: mockUpdateSupervisor,
    removeSupervisor: mockRemoveSupervisor,
  } as unknown as ReturnType<typeof getVideoService>);

describe("PATCH /api/admin/videos/[id]/supervisors/[supervisorId]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockService();
  });

  it("test_PATCH_unauthenticated_returns_401", async () => {
    vi.mocked(getServerSession).mockResolvedValue(null);

    const response = await PATCH(makeRequest("PATCH", { name: "鈴木花子" }), { params });

    expect(response.status).toBe(401);
  });

  it("test_PATCH_student_role_returns_403", async () => {
    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: "u-1", role: UserRole.STUDENT },
    });

    const response = await PATCH(makeRequest("PATCH", { name: "鈴木花子" }), { params });

    expect(response.status).toBe(403);
  });

  it("test_PATCH_valid_body_returns_200_with_supervisor", async () => {
    vi.mocked(getServerSession).mockResolvedValue(adminSession);
    mockUpdateSupervisor.mockResolvedValue({ ...mockSupervisor, name: "鈴木花子" });

    const response = await PATCH(makeRequest("PATCH", { name: "鈴木花子" }), { params });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.supervisor.name).toBe("鈴木花子");
    expect(mockUpdateSupervisor).toHaveBeenCalledWith("supervisor-1", { name: "鈴木花子" });
  });

  it("test_PATCH_supervisor_not_found_returns_404", async () => {
    vi.mocked(getServerSession).mockResolvedValue(adminSession);
    mockUpdateSupervisor.mockRejectedValue(new SupervisorNotFoundError("supervisor-1"));

    const response = await PATCH(makeRequest("PATCH", { name: "test" }), { params });

    expect(response.status).toBe(404);
  });
});

describe("DELETE /api/admin/videos/[id]/supervisors/[supervisorId]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockService();
  });

  it("test_DELETE_unauthenticated_returns_401", async () => {
    vi.mocked(getServerSession).mockResolvedValue(null);

    const response = await DELETE(makeRequest("DELETE"), { params });

    expect(response.status).toBe(401);
  });

  it("test_DELETE_student_role_returns_403", async () => {
    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: "u-1", role: UserRole.STUDENT },
    });

    const response = await DELETE(makeRequest("DELETE"), { params });

    expect(response.status).toBe(403);
  });

  it("test_DELETE_existing_supervisor_returns_204", async () => {
    vi.mocked(getServerSession).mockResolvedValue(adminSession);
    mockRemoveSupervisor.mockResolvedValue(undefined);

    const response = await DELETE(makeRequest("DELETE"), { params });

    expect(response.status).toBe(204);
    expect(mockRemoveSupervisor).toHaveBeenCalledWith("supervisor-1");
  });

  it("test_DELETE_supervisor_not_found_returns_404", async () => {
    vi.mocked(getServerSession).mockResolvedValue(adminSession);
    mockRemoveSupervisor.mockRejectedValue(new SupervisorNotFoundError("supervisor-1"));

    const response = await DELETE(makeRequest("DELETE"), { params });

    expect(response.status).toBe(404);
  });

  it("test_DELETE_last_supervisor_of_published_video_returns_400", async () => {
    vi.mocked(getServerSession).mockResolvedValue(adminSession);
    mockRemoveSupervisor.mockRejectedValue(
      new BusinessError("公開中の動画から最後の監修者を削除することはできません")
    );

    const response = await DELETE(makeRequest("DELETE"), { params });

    expect(response.status).toBe(400);
  });
});
