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
  constructor(email: string) {
    super(`このメールアドレスはすでに使用されています: ${email}`);
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
