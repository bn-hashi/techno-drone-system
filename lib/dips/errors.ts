/** DIPS 連携が無効 (DIPS_ENABLED !== "true") の状態で連携機能を呼び出した */
export class DipsDisabledError extends Error {
  constructor() {
    super("DIPS連携は現在無効です");
    this.name = "DipsDisabledError";
  }
}

/** DIPS 連携に必要な環境変数が不足している */
export class DipsConfigError extends Error {
  constructor(missingKeys: readonly string[]) {
    super(`DIPS連携の環境変数が不足しています: ${missingKeys.join(", ")}`);
    this.name = "DipsConfigError";
  }
}

/** DIPS へのユーザーログイン (認可コードフロー) が必要。UI はログイン誘導を表示する */
export class DipsAuthRequiredError extends Error {
  constructor(realm: string) {
    super(`DIPSへのログインが必要です (realm: ${realm})`);
    this.name = "DipsAuthRequiredError";
  }
}

/** ガイドライン未入手のため未対応の API を呼び出した */
export class DipsUnsupportedApiError extends Error {
  constructor(apiName: string) {
    super(`${apiName} はガイドライン未入手のため未対応です`);
    this.name = "DipsUnsupportedApiError";
  }
}

/** OIDC トークン取得に失敗した (HTTPエラー応答、またはタイムアウト・接続失敗などネットワークエラー) */
export class DipsAuthError extends Error {
  constructor(
    message: string,
    readonly status?: number,
    readonly cause?: unknown
  ) {
    super(message);
    this.name = "DipsAuthError";
  }
}

/** DIPS API がエラーレスポンスを返した (HTTPエラー応答、またはタイムアウト・接続失敗・不正JSONなど) */
export class DipsApiError extends Error {
  constructor(
    message: string,
    readonly status?: number,
    readonly responseBody?: string,
    readonly cause?: unknown
  ) {
    super(message);
    this.name = "DipsApiError";
  }
}
