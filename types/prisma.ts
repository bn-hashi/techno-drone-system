/**
 * Prisma Enum 型定義
 *
 * Prisma スキーマの enum を TypeScript の const object として定義する。
 * これにより Prisma Client 不要でテスト可能にする。
 */

export const UserRole = {
  ADMIN: "ADMIN",
  STUDENT: "STUDENT",
  PILOT: "PILOT",
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
export type DIPSExportStatus = (typeof DIPSExportStatus)[keyof typeof DIPSExportStatus];

export const FraudFlagType = {
  TAB_LEAVE: "TAB_LEAVE",
  CONCURRENT_LOGIN: "CONCURRENT_LOGIN",
  SPEED_VIOLATION: "SPEED_VIOLATION",
} as const;
export type FraudFlagType = (typeof FraudFlagType)[keyof typeof FraudFlagType];

export const JudgmentResult = {
  ACCEPTED: "ACCEPTED",
  REJECTED: "REJECTED",
} as const;
export type JudgmentResult = (typeof JudgmentResult)[keyof typeof JudgmentResult];

export const FlightPlanStatus = {
  DRAFT: "DRAFT",
  APPROVED: "APPROVED",
  REJECTED: "REJECTED",
  COMPLETED: "COMPLETED",
} as const;
export type FlightPlanStatus = (typeof FlightPlanStatus)[keyof typeof FlightPlanStatus];

export const InspectionPhase = {
  PRE_FLIGHT: "PRE_FLIGHT",
  POST_FLIGHT: "POST_FLIGHT",
} as const;
export type InspectionPhase = (typeof InspectionPhase)[keyof typeof InspectionPhase];

export const InspectionResult = {
  PASS: "PASS",
  FAIL: "FAIL",
  NA: "NA",
} as const;
export type InspectionResult = (typeof InspectionResult)[keyof typeof InspectionResult];
