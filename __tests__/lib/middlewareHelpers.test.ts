import { describe, it, expect } from "vitest";
import { UserRole, UserStatus } from "@/types/prisma";
import { determineRedirect } from "@/lib/middlewareHelpers";

describe("middlewareHelpers", () => {
  describe("determineRedirect", () => {
    it("test_determineRedirect_null_token_on_admin_path_returns_login", () => {
      const result = determineRedirect("/admin/dashboard", null);
      expect(result).toBe("/login");
    });

    it("test_determineRedirect_null_token_on_student_path_returns_login", () => {
      const result = determineRedirect("/student/courses", null);
      expect(result).toBe("/login");
    });

    it("test_determineRedirect_admin_role_on_admin_path_returns_allow", () => {
      const token = { role: UserRole.ADMIN, status: UserStatus.ACTIVE };
      const result = determineRedirect("/admin/dashboard", token);
      expect(result).toBe("allow");
    });

    it("test_determineRedirect_student_role_on_student_path_returns_allow", () => {
      const token = { role: UserRole.STUDENT, status: UserStatus.ACTIVE };
      const result = determineRedirect("/student/courses", token);
      expect(result).toBe("allow");
    });

    it("test_determineRedirect_student_role_on_admin_path_returns_login", () => {
      const token = { role: UserRole.STUDENT, status: UserStatus.ACTIVE };
      const result = determineRedirect("/admin/dashboard", token);
      expect(result).toBe("/login");
    });

    it("test_determineRedirect_admin_role_on_student_path_returns_login", () => {
      const token = { role: UserRole.ADMIN, status: UserStatus.ACTIVE };
      const result = determineRedirect("/student/courses", token);
      expect(result).toBe("/login");
    });

    it("test_determineRedirect_admin_role_on_administrator_path_returns_allow", () => {
      // /administrator は /admin ルートではないため通過させる
      const token = { role: UserRole.ADMIN, status: UserStatus.ACTIVE };
      const result = determineRedirect("/administrator", token);
      expect(result).toBe("allow");
    });

    it("test_determineRedirect_student_role_on_administrator_path_returns_allow", () => {
      // /administrator は /admin ルートではないため STUDENT も通過できる
      const token = { role: UserRole.STUDENT, status: UserStatus.ACTIVE };
      const result = determineRedirect("/administrator", token);
      expect(result).toBe("allow");
    });

    it("test_determineRedirect_pending_registration_status_returns_login", () => {
      // 停止・未承認アカウントはロールに関わらず拒否
      const token = { role: UserRole.STUDENT, status: UserStatus.PENDING_REGISTRATION };
      const result = determineRedirect("/student/courses", token);
      expect(result).toBe("/login");
    });

    it("test_determineRedirect_pending_activation_status_returns_login", () => {
      // 本登録待ちアカウントはロールに関わらず拒否
      const token = { role: UserRole.STUDENT, status: UserStatus.PENDING_ACTIVATION };
      const result = determineRedirect("/student/courses", token);
      expect(result).toBe("/login");
    });
  });
});
