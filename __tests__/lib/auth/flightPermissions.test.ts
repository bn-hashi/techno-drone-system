import { describe, it, expect } from "vitest";
import { UserRole } from "@/types/prisma";
import { FLIGHT_ROLES, hasFlightAccess } from "@/lib/auth/flightPermissions";

describe("FLIGHT_ROLES", () => {
  it("test_flight_roles_includes_admin", () => {
    expect(FLIGHT_ROLES).toContain(UserRole.ADMIN);
  });

  it("test_flight_roles_includes_pilot", () => {
    expect(FLIGHT_ROLES).toContain(UserRole.PILOT);
  });

  it("test_flight_roles_excludes_student", () => {
    expect(FLIGHT_ROLES).not.toContain(UserRole.STUDENT);
  });
});

describe("hasFlightAccess", () => {
  it("test_admin_has_flight_access", () => {
    expect(hasFlightAccess(UserRole.ADMIN)).toBe(true);
  });

  it("test_pilot_has_flight_access", () => {
    expect(hasFlightAccess(UserRole.PILOT)).toBe(true);
  });

  it("test_student_has_no_flight_access", () => {
    expect(hasFlightAccess(UserRole.STUDENT)).toBe(false);
  });
});
