import { describe, it, expect } from "vitest"
import { UserRole } from "@/types/prisma"
import { determineRedirect } from "@/lib/middlewareHelpers"

describe("middlewareHelpers", () => {
  describe("determineRedirect", () => {
    it("test_determineRedirect_null_token_on_admin_path_returns_login", () => {
      const result = determineRedirect("/admin/dashboard", null)
      expect(result).toBe("/login")
    })

    it("test_determineRedirect_null_token_on_student_path_returns_login", () => {
      const result = determineRedirect("/student/courses", null)
      expect(result).toBe("/login")
    })

    it("test_determineRedirect_admin_role_on_admin_path_returns_allow", () => {
      const token = { role: UserRole.ADMIN }
      const result = determineRedirect("/admin/dashboard", token)
      expect(result).toBe("allow")
    })

    it("test_determineRedirect_student_role_on_student_path_returns_allow", () => {
      const token = { role: UserRole.STUDENT }
      const result = determineRedirect("/student/courses", token)
      expect(result).toBe("allow")
    })

    it("test_determineRedirect_student_role_on_admin_path_returns_login", () => {
      const token = { role: UserRole.STUDENT }
      const result = determineRedirect("/admin/dashboard", token)
      expect(result).toBe("/login")
    })

    it("test_determineRedirect_admin_role_on_student_path_returns_login", () => {
      const token = { role: UserRole.ADMIN }
      const result = determineRedirect("/student/courses", token)
      expect(result).toBe("/login")
    })
  })
})
