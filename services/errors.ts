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

/** ユーザーが見つからない (404 Not Found 相当) */
export class UserNotFoundError extends Error {
  constructor(userId: string) {
    super(`ユーザーが見つかりません: ${userId}`);
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
