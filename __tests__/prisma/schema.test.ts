/**
 * Prisma スキーマ定義テスト
 *
 * TDD: RED フェーズ
 * - スキーマ型・テーブル定義の整合性テスト
 * - Prisma Client の型安全性テスト
 *
 * NOTE: 実際のDB接続は不要。型レベルのテストを中心とする。
 * DB統合テストは __tests__/prisma/integration.test.ts に分離。
 */

import { describe, it, expect } from "vitest";
import {
  UserRole,
  CourseType,
  UserStatus,
  ExamStatus,
  DIPSExportStatus,
  FraudFlagType,
} from "@/types/prisma";
import {
  INSTITUTION_CODE,
  SUBJECT_CODES,
  PASSING_SCORE_THRESHOLD,
  CERTIFICATE_VALIDITY_YEARS,
} from "@/lib/constants";

// ===========================
// Enum 定義テスト
// ===========================

describe("UserRole enum", () => {
  it("test_user_role_has_admin_value", () => {
    expect(UserRole.ADMIN).toBe("ADMIN");
  });

  it("test_user_role_has_student_value", () => {
    expect(UserRole.STUDENT).toBe("STUDENT");
  });

  it("test_user_role_has_pilot_value", () => {
    expect(UserRole.PILOT).toBe("PILOT");
  });

  it("test_user_role_has_exactly_three_values", () => {
    const values = Object.values(UserRole);
    expect(values).toHaveLength(3);
  });
});

describe("CourseType enum", () => {
  it("test_course_type_has_beginner_value", () => {
    expect(CourseType.BEGINNER).toBe("BEGINNER");
  });

  it("test_course_type_has_experienced_value", () => {
    expect(CourseType.EXPERIENCED).toBe("EXPERIENCED");
  });

  it("test_course_type_has_exactly_two_values", () => {
    const values = Object.values(CourseType);
    expect(values).toHaveLength(2);
  });
});

describe("UserStatus enum", () => {
  it("test_user_status_has_pending_registration", () => {
    expect(UserStatus.PENDING_REGISTRATION).toBe("PENDING_REGISTRATION");
  });

  it("test_user_status_has_pending_activation", () => {
    expect(UserStatus.PENDING_ACTIVATION).toBe("PENDING_ACTIVATION");
  });

  it("test_user_status_has_active", () => {
    expect(UserStatus.ACTIVE).toBe("ACTIVE");
  });

  it("test_user_status_has_exam_passed", () => {
    expect(UserStatus.EXAM_PASSED).toBe("EXAM_PASSED");
  });

  it("test_user_status_has_completed", () => {
    expect(UserStatus.COMPLETED).toBe("COMPLETED");
  });

  it("test_user_status_has_certified", () => {
    expect(UserStatus.CERTIFIED).toBe("CERTIFIED");
  });

  it("test_user_status_has_dips_linked", () => {
    expect(UserStatus.DIPS_LINKED).toBe("DIPS_LINKED");
  });

  it("test_user_status_has_exactly_seven_values", () => {
    const values = Object.values(UserStatus);
    expect(values).toHaveLength(7);
  });

  it("test_user_status_transition_order_has_seven_steps", () => {
    const transitionOrder = [
      UserStatus.PENDING_REGISTRATION,
      UserStatus.PENDING_ACTIVATION,
      UserStatus.ACTIVE,
      UserStatus.EXAM_PASSED,
      UserStatus.COMPLETED,
      UserStatus.CERTIFIED,
      UserStatus.DIPS_LINKED,
    ];
    expect(transitionOrder).toHaveLength(7);
  });

  it("test_user_status_transition_order_starts_with_pending_registration", () => {
    const transitionOrder = [
      UserStatus.PENDING_REGISTRATION,
      UserStatus.PENDING_ACTIVATION,
      UserStatus.ACTIVE,
      UserStatus.EXAM_PASSED,
      UserStatus.COMPLETED,
      UserStatus.CERTIFIED,
      UserStatus.DIPS_LINKED,
    ];
    expect(transitionOrder[0]).toBe("PENDING_REGISTRATION");
  });

  it("test_user_status_transition_order_ends_with_dips_linked", () => {
    const transitionOrder = [
      UserStatus.PENDING_REGISTRATION,
      UserStatus.PENDING_ACTIVATION,
      UserStatus.ACTIVE,
      UserStatus.EXAM_PASSED,
      UserStatus.COMPLETED,
      UserStatus.CERTIFIED,
      UserStatus.DIPS_LINKED,
    ];
    expect(transitionOrder[6]).toBe("DIPS_LINKED");
  });
});

describe("ExamStatus enum", () => {
  it("test_exam_status_has_in_progress", () => {
    expect(ExamStatus.IN_PROGRESS).toBe("IN_PROGRESS");
  });

  it("test_exam_status_has_passed", () => {
    expect(ExamStatus.PASSED).toBe("PASSED");
  });

  it("test_exam_status_has_failed", () => {
    expect(ExamStatus.FAILED).toBe("FAILED");
  });
});

describe("DIPSExportStatus enum", () => {
  it("test_dips_export_status_has_pending", () => {
    expect(DIPSExportStatus.PENDING).toBe("PENDING");
  });

  it("test_dips_export_status_has_exported", () => {
    expect(DIPSExportStatus.EXPORTED).toBe("EXPORTED");
  });

  it("test_dips_export_status_has_confirmed", () => {
    expect(DIPSExportStatus.CONFIRMED).toBe("CONFIRMED");
  });

  it("test_dips_export_status_has_exactly_three_values", () => {
    const values = Object.values(DIPSExportStatus);
    expect(values).toHaveLength(3);
  });
});

describe("FraudFlagType enum", () => {
  it("test_fraud_flag_type_has_tab_leave", () => {
    expect(FraudFlagType.TAB_LEAVE).toBe("TAB_LEAVE");
  });

  it("test_fraud_flag_type_has_concurrent_login", () => {
    expect(FraudFlagType.CONCURRENT_LOGIN).toBe("CONCURRENT_LOGIN");
  });

  it("test_fraud_flag_type_has_speed_violation", () => {
    expect(FraudFlagType.SPEED_VIOLATION).toBe("SPEED_VIOLATION");
  });

  it("test_fraud_flag_type_has_exactly_three_values", () => {
    const values = Object.values(FraudFlagType);
    expect(values).toHaveLength(3);
  });
});

// ===========================
// スキーマ定数テスト
// ===========================

describe("Schema constants", () => {
  it("test_institution_code_is_0515", () => {
    expect(INSTITUTION_CODE).toBe("0515");
  });

  it("test_subject_codes_contains_subject_01", () => {
    expect(SUBJECT_CODES).toContain("SUBJECT_01");
  });

  it("test_subject_codes_contains_subject_02", () => {
    expect(SUBJECT_CODES).toContain("SUBJECT_02");
  });

  it("test_subject_codes_contains_subject_03", () => {
    expect(SUBJECT_CODES).toContain("SUBJECT_03");
  });

  it("test_subject_codes_contains_subject_04", () => {
    expect(SUBJECT_CODES).toContain("SUBJECT_04");
  });

  it("test_subject_codes_has_exactly_four_values", () => {
    expect(SUBJECT_CODES).toHaveLength(4);
  });

  it("test_passing_score_threshold_is_80_percent", () => {
    expect(PASSING_SCORE_THRESHOLD).toBe(80);
  });

  it("test_certificate_validity_years_is_one", () => {
    expect(CERTIFICATE_VALIDITY_YEARS).toBe(1);
  });
});
