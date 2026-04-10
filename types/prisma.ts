/**
 * Prisma Enum 型定義
 *
 * Prisma スキーマの enum を TypeScript の const object として定義する。
 * これにより Prisma Client 不要でテスト可能にする。
 */

export const UserRole = {
  ADMIN: "ADMIN",
  STUDENT: "STUDENT",
} as const;
export type UserRole = (typeof UserRole)[keyof typeof UserRole];

export const CourseType = {
  BEGINNER: "BEGINNER",
  EXPERIENCED: "EXPERIENCED",
} as const;
export type CourseType = (typeof CourseType)[keyof typeof CourseType];

export const UserStatus = {
  PENDING_REGISTRATION: "PENDING_REGISTRATION",
  PENDING_ACTIVATION: "PENDING_ACTIVATION",
  ACTIVE: "ACTIVE",
  EXAM_PASSED: "EXAM_PASSED",
  COMPLETED: "COMPLETED",
  CERTIFIED: "CERTIFIED",
  DIPS_LINKED: "DIPS_LINKED",
} as const;
export type UserStatus = (typeof UserStatus)[keyof typeof UserStatus];

export const ExamStatus = {
  IN_PROGRESS: "IN_PROGRESS",
  PASSED: "PASSED",
  FAILED: "FAILED",
} as const;
export type ExamStatus = (typeof ExamStatus)[keyof typeof ExamStatus];

export const DIPSExportStatus = {
  PENDING: "PENDING",
  EXPORTED: "EXPORTED",
  CONFIRMED: "CONFIRMED",
} as const;
export type DIPSExportStatus =
  (typeof DIPSExportStatus)[keyof typeof DIPSExportStatus];

export const FraudFlagType = {
  TAB_LEAVE: "TAB_LEAVE",
  CONCURRENT_LOGIN: "CONCURRENT_LOGIN",
  SPEED_VIOLATION: "SPEED_VIOLATION",
} as const;
export type FraudFlagType = (typeof FraudFlagType)[keyof typeof FraudFlagType];
