import { UserRepository } from "@/repositories/userRepository";
import { UserManagementService } from "@/services/userManagementService";
import { CourseAccessService } from "@/services/courseAccessService";
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
import { QARecordRepository } from "@/repositories/qaRecordRepository";
import { QAService } from "@/services/qaService";
import { JudgmentRecordRepository } from "@/repositories/judgmentRecordRepository";
import { JudgmentService } from "@/services/judgmentService";
import { CompletionCertificateRepository } from "@/repositories/completionCertificateRepository";
import { CertificateService } from "@/services/certificateService";
import { CertificateLedgerService } from "@/services/certificateLedgerService";
import { ReactPdfCertificateGenerator } from "@/lib/certificate/pdfGenerator";
import { ReactPdfLedgerGenerator } from "@/lib/certificate/ledgerPdfGenerator";
import { LocalFsCertificateFileWriter } from "@/lib/certificate/fileWriter";
import { AircraftRepository } from "@/repositories/aircraftRepository";
import { AircraftService } from "@/services/aircraftService";
import { DashboardRepository } from "@/repositories/dashboardRepository";
import { DashboardService } from "@/services/dashboardService";
import { FlightPlanRepository } from "@/repositories/flightPlanRepository";
import { FlightPlanService } from "@/services/flightPlanService";
import { FlightLogRepository } from "@/repositories/flightLogRepository";
import { FlightLogService } from "@/services/flightLogService";
import { isDipsEnabled, getDipsConfig } from "@/lib/dips/config";
import type { DipsConfig } from "@/lib/dips/config";
import { DipsOidcClient } from "@/lib/dips/oidcClient";
import { DipsApiClient } from "@/lib/dips/dipsApiClient";
import { DipsDisabledError } from "@/lib/dips/errors";
import { DipsService } from "@/services/dipsService";

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

/** コースアクセス認可 Service のインスタンスを返す */
export function getCourseAccessService(): CourseAccessService {
  return new CourseAccessService(new UserRepository(), new CourseRepository());
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
    new SubjectProgressRepository(),
    getCourseAccessService(),
    getProgressService()
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

/** 質疑応答 Service のインスタンスを返す */
export function getQAService(): QAService {
  return new QAService(new QARecordRepository(), new UserRepository());
}

/** 受講確認・成立判定 Service のインスタンスを返す */
export function getJudgmentService(): JudgmentService {
  return new JudgmentService(
    new JudgmentRecordRepository(),
    new FraudFlagRepository(),
    getProgressService(),
    getUserManagementService()
  );
}

/** 修了証明書 Service のインスタンスを返す */
export function getCertificateService(): CertificateService {
  return new CertificateService(
    new CompletionCertificateRepository(),
    new EnrollmentApplicationRepository(),
    getUserManagementService(),
    new ReactPdfCertificateGenerator(),
    new LocalFsCertificateFileWriter()
  );
}

/** 修了証明書交付台帳 (様式5) Service のインスタンスを返す */
export function getCertificateLedgerService(): CertificateLedgerService {
  return new CertificateLedgerService(
    new CompletionCertificateRepository(),
    new EnrollmentApplicationRepository(),
    getUserManagementService(),
    new ReactPdfLedgerGenerator()
  );
}

/** 機体管理 Service のインスタンスを返す */
export function getAircraftService(): AircraftService {
  return new AircraftService(new AircraftRepository());
}

/** 管理ダッシュボード統計 Service のインスタンスを返す */
export function getDashboardService(): DashboardService {
  return new DashboardService(new DashboardRepository());
}

/** 飛行計画 Service のインスタンスを返す */
export function getFlightPlanService(): FlightPlanService {
  return new FlightPlanService(new FlightPlanRepository(), getAircraftService());
}

/** 飛行日誌 Service のインスタンスを返す */
export function getFlightLogService(): FlightLogService {
  return new FlightLogService(
    new FlightLogRepository(),
    getAircraftService(),
    getFlightPlanService()
  );
}

// DipsOidcClient はグループ別トークンをメモリキャッシュするため、リクエストのたびに
// 再生成すると毎回トークンを再取得してしまう。プロセス内で使い回すモジュールレベル変数として保持する。
let cachedDipsOidcClient: DipsOidcClient | undefined;

function getDipsOidcClient(config: DipsConfig): DipsOidcClient {
  if (!cachedDipsOidcClient) {
    cachedDipsOidcClient = new DipsOidcClient(config);
  }
  return cachedDipsOidcClient;
}

/**
 * DIPS 連携 Service のインスタンスを返す
 *
 * DIPS_ENABLED !== "true" の場合は DipsDisabledError を投げる (呼び出し元で 503 に変換)。
 * 検証環境は IP 制限があるためローカル開発では無効のまま運用する。
 */
export function getDipsService(): DipsService {
  if (!isDipsEnabled()) {
    throw new DipsDisabledError();
  }
  const config = getDipsConfig();
  return new DipsService(
    new DipsApiClient(config, getDipsOidcClient(config)),
    getAircraftService(),
    getFlightPlanService()
  );
}
