/**
 * シードデータ冪等性テスト
 *
 * TDD: RED フェーズ
 * - シードデータの整合性テスト
 * - 冪等性テスト（モックベース）
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  SEED_ADMIN,
  SEED_SUBJECTS,
  SEED_COURSE,
  SEED_QUESTIONS,
} from "@/prisma/seed-data";

// ===========================
// シードデータ整合性テスト
// ===========================

describe("SEED_ADMIN", () => {
  it("test_seed_admin_has_required_fields", () => {
    expect(SEED_ADMIN).toHaveProperty("email");
    expect(SEED_ADMIN).toHaveProperty("name");
    expect(SEED_ADMIN).toHaveProperty("role");
  });

  it("test_seed_admin_role_is_admin", () => {
    expect(SEED_ADMIN.role).toBe("ADMIN");
  });
});

describe("SEED_SUBJECTS", () => {
  it("test_seed_subjects_has_exactly_four_subjects", () => {
    expect(SEED_SUBJECTS).toHaveLength(4);
  });

  it("test_seed_subjects_codes_are_correct", () => {
    const codes = SEED_SUBJECTS.map((s) => s.code);
    expect(codes).toContain("SUBJECT_01");
    expect(codes).toContain("SUBJECT_02");
    expect(codes).toContain("SUBJECT_03");
    expect(codes).toContain("SUBJECT_04");
  });

  it("test_seed_subject_01_required_minutes_beginner_is_180", () => {
    const subject01 = SEED_SUBJECTS.find((s) => s.code === "SUBJECT_01");
    expect(subject01?.requiredMinutesBeginner).toBe(180);
  });

  it("test_seed_subject_01_required_minutes_experienced_is_60", () => {
    const subject01 = SEED_SUBJECTS.find((s) => s.code === "SUBJECT_01");
    expect(subject01?.requiredMinutesExperienced).toBe(60);
  });

  it("test_seed_subject_02_required_minutes_beginner_is_210", () => {
    const subject02 = SEED_SUBJECTS.find((s) => s.code === "SUBJECT_02");
    expect(subject02?.requiredMinutesBeginner).toBe(210);
  });

  it("test_seed_subject_03_required_minutes_beginner_is_120", () => {
    const subject03 = SEED_SUBJECTS.find((s) => s.code === "SUBJECT_03");
    expect(subject03?.requiredMinutesBeginner).toBe(120);
  });

  it("test_seed_subject_04_required_minutes_beginner_is_90", () => {
    const subject04 = SEED_SUBJECTS.find((s) => s.code === "SUBJECT_04");
    expect(subject04?.requiredMinutesBeginner).toBe(90);
  });

  it("test_seed_subject_04_required_minutes_experienced_is_30", () => {
    const subject04 = SEED_SUBJECTS.find((s) => s.code === "SUBJECT_04");
    expect(subject04?.requiredMinutesExperienced).toBe(30);
  });
});

describe("SEED_COURSE", () => {
  it("test_seed_course_has_required_fields", () => {
    expect(SEED_COURSE).toHaveProperty("name");
    expect(SEED_COURSE).toHaveProperty("type");
  });
});

describe("SEED_QUESTIONS", () => {
  it("test_seed_questions_has_exactly_five_questions", () => {
    expect(SEED_QUESTIONS).toHaveLength(5);
  });

  it("test_seed_questions_each_has_required_fields", () => {
    for (const q of SEED_QUESTIONS) {
      expect(q).toHaveProperty("body");
      expect(q).toHaveProperty("choices");
      expect(q).toHaveProperty("correctIndex");
      expect(q).toHaveProperty("explanation");
    }
  });

  it("test_seed_questions_choices_has_three_options", () => {
    for (const q of SEED_QUESTIONS) {
      expect(q.choices).toHaveLength(3);
    }
  });

  it("test_seed_questions_correct_index_is_valid", () => {
    for (const q of SEED_QUESTIONS) {
      expect(q.correctIndex).toBeGreaterThanOrEqual(0);
      expect(q.correctIndex).toBeLessThanOrEqual(2);
    }
  });
});
