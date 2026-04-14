import { describe, it, expect } from "vitest"
import { UserStatus } from "@/types/prisma"
import { isLoginAllowed, getLoginBlockedMessage } from "@/lib/authHelpers"

describe("authHelpers", () => {
  describe("isLoginAllowed", () => {
    it("test_isLoginAllowed_active_returns_true", () => {
      const result = isLoginAllowed(UserStatus.ACTIVE)
      expect(result).toBe(true)
    })

    it("test_isLoginAllowed_exam_passed_returns_true", () => {
      const result = isLoginAllowed(UserStatus.EXAM_PASSED)
      expect(result).toBe(true)
    })

    it("test_isLoginAllowed_completed_returns_true", () => {
      const result = isLoginAllowed(UserStatus.COMPLETED)
      expect(result).toBe(true)
    })

    it("test_isLoginAllowed_certified_returns_true", () => {
      const result = isLoginAllowed(UserStatus.CERTIFIED)
      expect(result).toBe(true)
    })

    it("test_isLoginAllowed_dips_linked_returns_true", () => {
      const result = isLoginAllowed(UserStatus.DIPS_LINKED)
      expect(result).toBe(true)
    })

    it("test_isLoginAllowed_pending_registration_returns_false", () => {
      const result = isLoginAllowed(UserStatus.PENDING_REGISTRATION)
      expect(result).toBe(false)
    })

    it("test_isLoginAllowed_pending_activation_returns_false", () => {
      const result = isLoginAllowed(UserStatus.PENDING_ACTIVATION)
      expect(result).toBe(false)
    })
  })

  describe("getLoginBlockedMessage", () => {
    it("test_getLoginBlockedMessage_pending_registration_returns_message", () => {
      const result = getLoginBlockedMessage(UserStatus.PENDING_REGISTRATION)
      expect(result).toBe("アカウント登録が完了していません")
    })

    it("test_getLoginBlockedMessage_pending_activation_returns_message", () => {
      const result = getLoginBlockedMessage(UserStatus.PENDING_ACTIVATION)
      expect(result).toBe("本登録メールをご確認ください")
    })
  })
})
