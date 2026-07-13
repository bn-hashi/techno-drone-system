/**
 * Service 層のカスタムエラークラス
 *
 * Controller は instanceof で分岐し、文字列マッチングに依存しない。
 */

/** ビジネスルール違反 (400 Bad Request 相当) */
export class BusinessError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BusinessError";
  }
}

/** メールアドレス重複 (409 Conflict 相当) */
export class DuplicateEmailError extends BusinessError {
  // メールアドレスをメッセージに含めるとユーザー列挙攻撃に利用されるため含めない
  constructor(_email: string) {
    super("このメールアドレスはすでに使用されています");
    this.name = "DuplicateEmailError";
  }
}

/** リソースが見つからない (404 Not Found 相当) */
export class NotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NotFoundError";
  }
}

/** ユーザーが見つからない (404 Not Found 相当) */
export class UserNotFoundError extends NotFoundError {
  constructor(_userId: string) {
    super("指定された受講者が見つかりません");
    this.name = "UserNotFoundError";
  }
}

/** 無効なステータス遷移 (400 Bad Request 相当) */
export class InvalidTransitionError extends BusinessError {
  constructor(from: string, to: string) {
    super(`無効なステータス遷移です: ${from} → ${to}`);
    this.name = "InvalidTransitionError";
  }
}

/** 入学申請が見つからない (404 Not Found 相当) */
export class EnrollmentNotFoundError extends NotFoundError {
  constructor(_id: string) {
    super("指定された入学申請が見つかりません");
    this.name = "EnrollmentNotFoundError";
  }
}

/** 入学申請の重複 (409 Conflict 相当) */
export class DuplicateEnrollmentError extends BusinessError {
  constructor(_userId: string) {
    super("この受講者はすでに入学申請済みです");
    this.name = "DuplicateEnrollmentError";
  }
}

/** 科目が見つからない (404 Not Found 相当) */
export class SubjectNotFoundError extends NotFoundError {
  constructor(_id: string) {
    super("指定された科目が見つかりません");
    this.name = "SubjectNotFoundError";
  }
}

/** コースが見つからない (404 Not Found 相当) */
export class CourseNotFoundError extends NotFoundError {
  constructor(_id: string) {
    super("指定されたコースが見つかりません");
    this.name = "CourseNotFoundError";
  }
}

/** 動画が見つからない (404 Not Found 相当) */
export class VideoNotFoundError extends NotFoundError {
  constructor(_id: string) {
    super("指定された動画が見つかりません");
    this.name = "VideoNotFoundError";
  }
}

/** 監修者が見つからない (404 Not Found 相当) */
export class SupervisorNotFoundError extends NotFoundError {
  constructor(_id: string) {
    super("指定された監修者が見つかりません");
    this.name = "SupervisorNotFoundError";
  }
}

/** 問題が見つからない (404 Not Found 相当) */
export class QuestionNotFoundError extends NotFoundError {
  constructor(_id: string) {
    super("指定された問題が見つかりません");
    this.name = "QuestionNotFoundError";
  }
}

/** 機体が見つからない (404 Not Found 相当) */
export class AircraftNotFoundError extends NotFoundError {
  constructor(_id: string) {
    super("指定された機体が見つかりません");
    this.name = "AircraftNotFoundError";
  }
}

/** 機体のシリアル番号重複 (409 Conflict 相当) */
export class AircraftDuplicateSerialError extends BusinessError {
  constructor(_serialNumber: string) {
    super("このシリアル番号の機体はすでに登録されています");
    this.name = "AircraftDuplicateSerialError";
  }
}

/** 飛行計画が見つからない (404 Not Found 相当) */
export class FlightPlanNotFoundError extends NotFoundError {
  constructor(_id: string) {
    super("指定された飛行計画が見つかりません");
    this.name = "FlightPlanNotFoundError";
  }
}

/** 無効なステータス遷移: 飛行計画 (400 Bad Request 相当) */
export class FlightPlanInvalidTransitionError extends BusinessError {
  constructor(from: string, to: string) {
    super(`この飛行計画のステータスを ${from} から ${to} に変更できません`);
    this.name = "FlightPlanInvalidTransitionError";
  }
}

/** 飛行日誌が見つからない (404 Not Found 相当) */
export class FlightLogNotFoundError extends NotFoundError {
  constructor(_id: string) {
    super("指定された飛行日誌が見つかりません");
    this.name = "FlightLogNotFoundError";
  }
}
