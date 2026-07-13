import { describe, it, expect, beforeEach, vi } from "vitest";
import { UserRole } from "@/types/prisma";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));

// next/navigation の redirect は例外を投げて処理を中断する仕様のため、
// テストでは投げたことを検知できるようエラーとして再現する
const mockRedirect = vi.fn((url: string): never => {
  throw new Error(`REDIRECT:${url}`);
});
vi.mock("next/navigation", () => ({
  redirect: (url: string) => mockRedirect(url),
}));

import { getServerSession } from "next-auth";
import { requireFlightSession } from "@/lib/auth/requireFlightSession";

/** 飛行管理 Server Component ページの認可境界 */
describe("requireFlightSession", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("test_unauthenticated_redirects_to_login", async () => {
    vi.mocked(getServerSession).mockResolvedValue(null);

    await expect(requireFlightSession()).rejects.toThrow("REDIRECT:/login");
    expect(mockRedirect).toHaveBeenCalledWith("/login");
  });

  it("test_student_role_redirects_to_login", async () => {
    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: "user-1", role: UserRole.STUDENT },
    });

    await expect(requireFlightSession()).rejects.toThrow("REDIRECT:/login");
  });

  it("test_pilot_role_returns_session_with_not_admin", async () => {
    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: "pilot-1", role: UserRole.PILOT },
    });

    const result = await requireFlightSession();

    expect(result).toEqual({ userId: "pilot-1", isAdmin: false });
    expect(mockRedirect).not.toHaveBeenCalled();
  });

  it("test_admin_role_returns_session_with_isAdmin_true", async () => {
    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: "admin-1", role: UserRole.ADMIN },
    });

    const result = await requireFlightSession();

    expect(result).toEqual({ userId: "admin-1", isAdmin: true });
  });
});
