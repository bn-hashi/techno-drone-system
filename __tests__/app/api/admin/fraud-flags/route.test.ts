import { describe, it, expect, beforeEach, vi } from "vitest";
import { UserRole } from "@/types/prisma";
import { FraudFlagType } from "@/types/prisma";

vi.mock("next-auth", () => ({
  getServerSession: vi.fn(),
}));

vi.mock("@/lib/serviceFactory", () => ({
  getFraudFlagService: vi.fn(),
}));

import { getServerSession } from "next-auth";
import { getFraudFlagService } from "@/lib/serviceFactory";
import { GET } from "@/app/api/admin/fraud-flags/route";

const mockListAllFlags = vi.fn();

const adminSession = {
  user: { id: "admin-1", email: "admin@example.com", role: UserRole.ADMIN },
};

const mockFlagWithUser = {
  id: "flag-1",
  userId: "user-1",
  type: FraudFlagType.TAB_LEAVE,
  description: "65 seconds",
  detectedAt: new Date("2026-01-01T10:00:00Z"),
  resolvedAt: null,
  user: { id: "user-1", name: "田中太郎", email: "tanaka@example.com" },
};

describe("GET /api/admin/fraud-flags", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getFraudFlagService).mockReturnValue({
      listAllFlags: mockListAllFlags,
      flagTabLeave: vi.fn(),
    } as unknown as ReturnType<typeof getFraudFlagService>);
  });

  it("test_GET_unauthenticated_returns_401", async () => {
    // Arrange
    vi.mocked(getServerSession).mockResolvedValue(null);

    // Act
    const response = await GET();

    // Assert
    expect(response.status).toBe(401);
  });

  it("test_GET_non_admin_returns_403", async () => {
    // Arrange
    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: "user-1", email: "student@example.com", role: UserRole.STUDENT },
    });

    // Act
    const response = await GET();

    // Assert
    expect(response.status).toBe(403);
  });

  it("test_GET_admin_returns_200_with_flags", async () => {
    // Arrange
    vi.mocked(getServerSession).mockResolvedValue(adminSession);
    mockListAllFlags.mockResolvedValue([mockFlagWithUser]);

    // Act
    const response = await GET();
    const body = await response.json();

    // Assert
    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data).toHaveLength(1);
  });

  it("test_GET_admin_returns_empty_array_when_no_flags", async () => {
    // Arrange
    vi.mocked(getServerSession).mockResolvedValue(adminSession);
    mockListAllFlags.mockResolvedValue([]);

    // Act
    const response = await GET();
    const body = await response.json();

    // Assert
    expect(response.status).toBe(200);
    expect(body.data).toEqual([]);
  });

  it("test_GET_service_error_returns_500", async () => {
    // Arrange
    vi.mocked(getServerSession).mockResolvedValue(adminSession);
    mockListAllFlags.mockRejectedValue(new Error("DB error"));

    // Act
    const response = await GET();

    // Assert
    expect(response.status).toBe(500);
  });
});
