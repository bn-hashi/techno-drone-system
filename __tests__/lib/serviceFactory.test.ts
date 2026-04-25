import { describe, it, expect } from "vitest";
import { getUserManagementService } from "@/lib/serviceFactory";
import { UserManagementService } from "@/services/userManagementService";

describe("getUserManagementService", () => {
  it("should return an instance of UserManagementService", () => {
    const service = getUserManagementService();
    expect(service).toBeInstanceOf(UserManagementService);
  });

  it("should return a new instance on each call", () => {
    const service1 = getUserManagementService();
    const service2 = getUserManagementService();
    expect(service1).not.toBe(service2);
  });
});
