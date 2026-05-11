import { describe, it, expect } from "vitest";
import { UserStatus } from "@/types/prisma";
import {
  STATUS_TRANSITIONS,
  getNextStatuses,
  isValidTransition,
} from "@/lib/constants/statusTransitions";

describe("STATUS_TRANSITIONS", () => {
  it("PENDING_REGISTRATION_has_one_next_status", () => {
    expect(STATUS_TRANSITIONS[UserStatus.PENDING_REGISTRATION]).toHaveLength(1);
  });

  it("DIPS_LINKED_has_no_next_statuses", () => {
    expect(STATUS_TRANSITIONS[UserStatus.DIPS_LINKED]).toHaveLength(0);
  });
});

describe("getNextStatuses", () => {
  it("PENDING_REGISTRATION_returns_PENDING_ACTIVATION", () => {
    const result = getNextStatuses(UserStatus.PENDING_REGISTRATION);

    expect(result).toContain(UserStatus.PENDING_ACTIVATION);
  });

  it("PENDING_ACTIVATION_returns_ACTIVE", () => {
    const result = getNextStatuses(UserStatus.PENDING_ACTIVATION);

    expect(result).toContain(UserStatus.ACTIVE);
  });

  it("ACTIVE_returns_EXAM_PASSED", () => {
    const result = getNextStatuses(UserStatus.ACTIVE);

    expect(result).toContain(UserStatus.EXAM_PASSED);
  });

  it("EXAM_PASSED_returns_COMPLETED", () => {
    const result = getNextStatuses(UserStatus.EXAM_PASSED);

    expect(result).toContain(UserStatus.COMPLETED);
  });

  it("COMPLETED_returns_CERTIFIED", () => {
    const result = getNextStatuses(UserStatus.COMPLETED);

    expect(result).toContain(UserStatus.CERTIFIED);
  });

  it("CERTIFIED_returns_DIPS_LINKED", () => {
    const result = getNextStatuses(UserStatus.CERTIFIED);

    expect(result).toContain(UserStatus.DIPS_LINKED);
  });

  it("DIPS_LINKED_returns_empty_array", () => {
    const result = getNextStatuses(UserStatus.DIPS_LINKED);

    expect(result).toHaveLength(0);
  });
});

describe("isValidTransition", () => {
  it("PENDING_REGISTRATION_to_PENDING_ACTIVATION_returns_true", () => {
    const result = isValidTransition(
      UserStatus.PENDING_REGISTRATION,
      UserStatus.PENDING_ACTIVATION
    );

    expect(result).toBe(true);
  });

  it("ACTIVE_to_EXAM_PASSED_returns_true", () => {
    const result = isValidTransition(UserStatus.ACTIVE, UserStatus.EXAM_PASSED);

    expect(result).toBe(true);
  });

  it("PENDING_REGISTRATION_to_ACTIVE_returns_false", () => {
    // スキップ遷移は不正
    const result = isValidTransition(
      UserStatus.PENDING_REGISTRATION,
      UserStatus.ACTIVE
    );

    expect(result).toBe(false);
  });

  it("ACTIVE_to_PENDING_REGISTRATION_returns_false", () => {
    // 逆方向遷移は不正
    const result = isValidTransition(
      UserStatus.ACTIVE,
      UserStatus.PENDING_REGISTRATION
    );

    expect(result).toBe(false);
  });

  it("same_status_returns_false", () => {
    const result = isValidTransition(UserStatus.ACTIVE, UserStatus.ACTIVE);

    expect(result).toBe(false);
  });

  it("DIPS_LINKED_to_any_returns_false", () => {
    // 最終状態からの遷移は不正
    const result = isValidTransition(
      UserStatus.DIPS_LINKED,
      UserStatus.CERTIFIED
    );

    expect(result).toBe(false);
  });
});
