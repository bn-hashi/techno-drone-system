import { describe, it, expect, beforeEach, vi } from "vitest";
import { UserRole } from "@/types/prisma";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));

import { getServerSession } from "next-auth";
import { requireFlightAccess } from "@/lib/auth/requireFlightAccess";

/** 飛行管理 API の認可境界。ロール制御の破れは他ユーザーデータ露出に直結する */
describe("requireFlightAccess", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("test_unauthenticated_returns_401_response", async () => {
    vi.mocked(getServerSession).mockResolvedValue(null);

    const result = await requireFlightAccess();

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(401);
    }
  });

  it("test_student_role_returns_403_response", async () => {
    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: "user-1", role: UserRole.STUDENT },
    });

    const result = await requireFlightAccess();

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(403);
    }
  });

  it("test_pilot_role_returns_ok_with_userId_and_not_admin", async () => {
    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: "pilot-1", role: UserRole.PILOT },
    });

    const result = await requireFlightAccess();

    expect(result).toEqual({ ok: true, userId: "pilot-1", isAdmin: false });
  });

  it("test_admin_role_returns_ok_with_isAdmin_true", async () => {
    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: "admin-1", role: UserRole.ADMIN },
    });

    const result = await requireFlightAccess();

    expect(result).toEqual({ ok: true, userId: "admin-1", isAdmin: true });
  });
});
