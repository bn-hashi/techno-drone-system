import { describe, it, expect, vi, beforeEach } from "vitest";
import { UserRole } from "@/types/prisma";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));

import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { requireAdminSession } from "@/lib/serverAuth";

describe("requireAdminSession", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("test_requireAdminSession_with_admin_does_not_redirect", async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: "a1", role: UserRole.ADMIN } });

    await requireAdminSession();

    expect(redirect).not.toHaveBeenCalled();
  });

  it("test_requireAdminSession_with_student_redirects_to_login", async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: "s1", role: UserRole.STUDENT } });

    await requireAdminSession();

    expect(redirect).toHaveBeenCalledWith("/login");
  });

  it("test_requireAdminSession_without_session_redirects_to_login", async () => {
    vi.mocked(getServerSession).mockResolvedValue(null);

    await requireAdminSession();

    expect(redirect).toHaveBeenCalledWith("/login");
  });
});
