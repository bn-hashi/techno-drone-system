import { describe, it, expect } from "vitest";
import { getUserManagementService } from "@/lib/serviceFactory";
import { UserManagementService } from "@/services/userManagementService";

describe("getUserManagementService", () => {
  it("test_getUserManagementService_returns_UserManagementService_instance", () => {
    const service = getUserManagementService();
    expect(service).toBeInstanceOf(UserManagementService);
  });

  it("test_getUserManagementService_returns_new_instance_on_each_call", () => {
    const service1 = getUserManagementService();
    const service2 = getUserManagementService();
    expect(service1).not.toBe(service2);
  });
});
