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
import { ViewingLogRepository } from "@/repositories/viewingLogRepository";
import { ViewingLogService } from "@/services/viewingLogService";
import { FraudFlagRepository } from "@/repositories/fraudFlagRepository";
import { FraudFlagService } from "@/services/fraudFlagService";
import { SubjectProgressRepository } from "@/repositories/subjectProgressRepository";
import { ProgressService } from "@/services/progressService";
import { QuestionRepository } from "@/repositories/questionRepository";
import { QuestionService } from "@/services/questionService";
import { ExamRepository } from "@/repositories/examRepository";
import { ExamAnswerRepository } from "@/repositories/examAnswerRepository";
import { ExamService } from "@/services/examService";

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

/** 視聴ログ Service のインスタンスを返す */
export function getViewingLogService(): ViewingLogService {
  return new ViewingLogService(
    new ViewingLogRepository(),
    new VideoRepository(),
    new SubjectProgressRepository()
  );
}

/** 不正フラグ Service のインスタンスを返す */
export function getFraudFlagService(): FraudFlagService {
  return new FraudFlagService(new FraudFlagRepository());
}

/** 進捗 Service のインスタンスを返す */
export function getProgressService(): ProgressService {
  return new ProgressService(
    new ViewingLogRepository(),
    new VideoRepository(),
    new SubjectRepository()
  );
}

/** 問題バンク Service のインスタンスを返す */
export function getQuestionService(): QuestionService {
  return new QuestionService(new QuestionRepository(), new SubjectRepository());
}

/** 修了確認試験 Service のインスタンスを返す */
export function getExamService(): ExamService {
  return new ExamService(
    new ExamRepository(),
    new ExamAnswerRepository(),
    new QuestionRepository(),
    new SubjectRepository(),
    getProgressService(),
    getUserManagementService()
  );
}
