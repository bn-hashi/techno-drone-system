import { UserRepository } from "@/repositories/userRepository";
import { UserManagementService } from "@/services/userManagementService";
import { EnrollmentApplicationRepository } from "@/repositories/enrollmentApplicationRepository";
import { EnrollmentService } from "@/services/enrollmentService";
import { AgreementLogRepository } from "@/repositories/agreementLogRepository";
import { SetupService } from "@/services/setupService";
import { SubjectRepository } from "@/repositories/subjectRepository";
import { SubjectService } from "@/services/subjectService";
import { CourseRepository } from "@/repositories/courseRepository";
import { CourseService } from "@/services/courseService";
import { VideoRepository } from "@/repositories/videoRepository";
import { VideoSupervisorRepository } from "@/repositories/videoSupervisorRepository";
import { VideoService } from "@/services/videoService";

// Service インスタンスの生成を一元管理する
// ページ・API ルートはこのファクトリ経由で Service を取得する

/** ユーザー管理 Service のインスタンスを返す */
export function getUserManagementService(): UserManagementService {
  return new UserManagementService(new UserRepository());
}

/** 入学申請 Service のインスタンスを返す */
export function getEnrollmentService(): EnrollmentService {
  return new EnrollmentService(new EnrollmentApplicationRepository(), new UserRepository());
}

/** セットアップ（パスワード設定・規約同意）Service のインスタンスを返す */
export function getSetupService(): SetupService {
  return new SetupService(new UserRepository(), new AgreementLogRepository());
}

/** 科目 Service のインスタンスを返す */
export function getSubjectService(): SubjectService {
  return new SubjectService(new SubjectRepository());
}

/** コース Service のインスタンスを返す */
export function getCourseService(): CourseService {
  return new CourseService(new CourseRepository());
}

/** 動画 Service のインスタンスを返す */
export function getVideoService(): VideoService {
  return new VideoService(new VideoRepository(), new VideoSupervisorRepository());
}
