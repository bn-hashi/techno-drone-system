import { describe, it, expect } from "vitest";
import { UserRole, UserStatus } from "@/types/prisma";
import {
  isLoginAllowed,
  getLoginBlockedMessage,
  isValidUserRole,
  isValidUserStatus,
  getLoginBlockedErrorCode,
} from "@/lib/authHelpers";

describe("authHelpers", () => {
  describe("isLoginAllowed", () => {
    it("test_isLoginAllowed_active_returns_true", () => {
      const result = isLoginAllowed(UserStatus.ACTIVE);
      expect(result).toBe(true);
    });

    it("test_isLoginAllowed_exam_passed_returns_true", () => {
      const result = isLoginAllowed(UserStatus.EXAM_PASSED);
      expect(result).toBe(true);
    });

    it("test_isLoginAllowed_completed_returns_true", () => {
      const result = isLoginAllowed(UserStatus.COMPLETED);
      expect(result).toBe(true);
    });

    it("test_isLoginAllowed_certified_returns_true", () => {
      const result = isLoginAllowed(UserStatus.CERTIFIED);
      expect(result).toBe(true);
    });

    it("test_isLoginAllowed_dips_linked_returns_true", () => {
      const result = isLoginAllowed(UserStatus.DIPS_LINKED);
      expect(result).toBe(true);
    });

    it("test_isLoginAllowed_pending_registration_returns_false", () => {
      const result = isLoginAllowed(UserStatus.PENDING_REGISTRATION);
      expect(result).toBe(false);
    });

    it("test_isLoginAllowed_pending_activation_returns_false", () => {
      const result = isLoginAllowed(UserStatus.PENDING_ACTIVATION);
      expect(result).toBe(false);
    });
  });

  describe("getLoginBlockedMessage", () => {
    it("test_getLoginBlockedMessage_pending_registration_returns_message", () => {
      const result = getLoginBlockedMessage(UserStatus.PENDING_REGISTRATION);
      expect(result).toBe("アカウント登録が完了していません");
    });

    it("test_getLoginBlockedMessage_pending_activation_returns_message", () => {
      const result = getLoginBlockedMessage(UserStatus.PENDING_ACTIVATION);
      expect(result).toBe("本登録メールをご確認ください");
    });
  });

  describe("isValidUserRole", () => {
    it("test_isValidUserRole_valid_role_returns_true", () => {
      expect(isValidUserRole(UserRole.STUDENT)).toBe(true);
    });

    it("test_isValidUserRole_admin_role_returns_true", () => {
      expect(isValidUserRole(UserRole.ADMIN)).toBe(true);
    });

    it("test_isValidUserRole_invalid_string_returns_false", () => {
      expect(isValidUserRole("SUPERUSER")).toBe(false);
    });

    it("test_isValidUserRole_null_returns_false", () => {
      expect(isValidUserRole(null)).toBe(false);
    });
  });

  describe("isValidUserStatus", () => {
    it("test_isValidUserStatus_active_returns_true", () => {
      expect(isValidUserStatus(UserStatus.ACTIVE)).toBe(true);
    });

    it("test_isValidUserStatus_invalid_string_returns_false", () => {
      expect(isValidUserStatus("UNKNOWN_STATUS")).toBe(false);
    });

    it("test_isValidUserStatus_undefined_returns_false", () => {
      expect(isValidUserStatus(undefined)).toBe(false);
    });
  });

  describe("getLoginBlockedErrorCode", () => {
    it("test_getLoginBlockedErrorCode_pending_activation_returns_account_pending", () => {
      const result = getLoginBlockedErrorCode(UserStatus.PENDING_ACTIVATION);
      expect(result).toBe("account_pending");
    });

    it("test_getLoginBlockedErrorCode_pending_registration_returns_account_not_active", () => {
      const result = getLoginBlockedErrorCode(UserStatus.PENDING_REGISTRATION);
      expect(result).toBe("account_not_active");
    });
  });
});
