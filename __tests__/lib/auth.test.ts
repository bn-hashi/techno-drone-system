import { describe, it, expect, vi } from "vitest";
import type { JWT } from "next-auth/jwt";
import type { Session } from "next-auth";

vi.mock("@/repositories/userRepository", () => ({
  UserRepository: vi.fn().mockImplementation(() => ({})),
}));

const mockLogin = vi.fn();
vi.mock("@/services/authService", () => ({
  AuthService: vi.fn().mockImplementation(() => ({ login: mockLogin })),
}));

import { authOptions } from "@/lib/auth";
import { UserRole, UserStatus } from "@/types/prisma";

// Extract callbacks for direct testing
const jwtCallback = authOptions.callbacks!.jwt!;
const sessionCallback = authOptions.callbacks!.session!;

// -----------------------------------------------------------------------
// jwt callback
// -----------------------------------------------------------------------

describe("authOptions.callbacks.jwt", () => {
  // Cast to satisfy JWT type: id/role/status are set by the callback on first sign-in
  const baseToken = { sub: "user-1" } as unknown as JWT;

  it("test_jwt_with_user_sets_id_on_token", async () => {
    // Arrange
    const user = {
      id: "user-1",
      email: "a@test.com",
      name: "A",
      role: UserRole.STUDENT,
      status: UserStatus.ACTIVE,
    };

    // Act
    const result = await jwtCallback({
      token: { ...baseToken },
      user,
      account: null,
      trigger: "signIn",
    });

    // Assert
    expect(result.id).toBe("user-1");
  });

  it("test_jwt_with_user_sets_role_on_token", async () => {
    // Arrange
    const user = {
      id: "user-1",
      email: "a@test.com",
      name: "A",
      role: UserRole.ADMIN,
      status: UserStatus.ACTIVE,
    };

    // Act
    const result = await jwtCallback({
      token: { ...baseToken },
      user,
      account: null,
      trigger: "signIn",
    });

    // Assert
    expect(result.role).toBe(UserRole.ADMIN);
  });

  it("test_jwt_with_user_sets_status_on_token", async () => {
    // Arrange
    const user = {
      id: "user-1",
      email: "a@test.com",
      name: "A",
      role: UserRole.STUDENT,
      status: UserStatus.ACTIVE,
    };

    // Act
    const result = await jwtCallback({
      token: { ...baseToken },
      user,
      account: null,
      trigger: "signIn",
    });

    // Assert
    expect(result.status).toBe(UserStatus.ACTIVE);
  });

  it("test_jwt_without_user_preserves_id_on_token", async () => {
    // Arrange — status required because JWT type has it as mandatory
    const token = {
      ...baseToken,
      id: "existing-id",
      role: UserRole.STUDENT,
      status: UserStatus.ACTIVE,
    };

    // Act
    const result = await jwtCallback({
      token,
      user: null as never,
      account: null,
      trigger: "update",
    });

    // Assert
    expect(result.id).toBe("existing-id");
  });

  it("test_jwt_without_user_preserves_role_on_token", async () => {
    // Arrange
    const token = {
      ...baseToken,
      id: "existing-id",
      role: UserRole.STUDENT,
      status: UserStatus.ACTIVE,
    };

    // Act
    const result = await jwtCallback({
      token,
      user: null as never,
      account: null,
      trigger: "update",
    });

    // Assert
    expect(result.role).toBe(UserRole.STUDENT);
  });
});

// -----------------------------------------------------------------------
// session callback
// -----------------------------------------------------------------------

describe("authOptions.callbacks.session", () => {
  const baseSession = {
    expires: "2099-01-01",
    user: {
      id: "",
      email: "a@test.com",
      name: "A",
      role: undefined as unknown as UserRole,
      status: undefined as unknown as UserStatus,
    },
  };

  // Helper to call sessionCallback without requiring AdapterUser (not available on "update" trigger)
  type SessionCallbackArg = Parameters<typeof sessionCallback>[0];

  it("test_session_with_valid_role_and_status_sets_user_id", async () => {
    // Arrange
    const token = { id: "user-1", role: UserRole.STUDENT, status: UserStatus.ACTIVE } as JWT;

    // Act
    const result = (await sessionCallback({
      session: { ...baseSession, user: { ...baseSession.user } },
      token,
      trigger: "update",
    } as SessionCallbackArg)) as Session;

    // Assert
    expect(result.user?.id).toBe("user-1");
  });

  it("test_session_with_valid_role_and_status_sets_role", async () => {
    // Arrange
    const token = { id: "user-1", role: UserRole.ADMIN, status: UserStatus.ACTIVE } as JWT;

    // Act
    const result = (await sessionCallback({
      session: { ...baseSession, user: { ...baseSession.user } },
      token,
      trigger: "update",
    } as SessionCallbackArg)) as Session;

    // Assert
    expect(result.user?.role).toBe(UserRole.ADMIN);
  });

  it("test_session_with_invalid_role_returns_session_without_user", async () => {
    // Arrange — deliberately invalid role to test fail-closed behaviour
    const token = {
      id: "user-1",
      role: "INVALID_ROLE" as unknown as UserRole,
      status: UserStatus.ACTIVE,
    } as JWT;

    // Act
    const result = (await sessionCallback({
      session: { ...baseSession, user: { ...baseSession.user } },
      token,
      trigger: "update",
    } as SessionCallbackArg)) as Session;

    // Assert
    expect(result.user).toBeUndefined();
  });

  it("test_session_with_invalid_status_returns_session_without_user", async () => {
    // Arrange — deliberately invalid status to test fail-closed behaviour
    const token = {
      id: "user-1",
      role: UserRole.STUDENT,
      status: "INVALID_STATUS" as unknown as UserStatus,
    } as JWT;

    // Act
    const result = (await sessionCallback({
      session: { ...baseSession, user: { ...baseSession.user } },
      token,
      trigger: "update",
    } as SessionCallbackArg)) as Session;

    // Assert
    expect(result.user).toBeUndefined();
  });
});
