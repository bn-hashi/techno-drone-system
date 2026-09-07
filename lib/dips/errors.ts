import type { DipsRealm } from "@/lib/dips/config";

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

/**
 * DIPS へのユーザーログイン (認可コードフロー) が必要。UI はログイン誘導を表示する。
 *
 * `realm` を `readonly` プロパティとして保持する (2026-08-26 差し戻し D1: 以前は
 * コンストラクタ引数のまま握りつぶしていたため、呼び出し元の API ルートが自前で
 * realm をハードコードしてしまい、realm がずれると無限ログインループになる事故が
 * あった)。呼び出し元は `error.realm` を使うこと。
 *
 * `realm` の型を `string` ではなく `DipsRealm` に絞る (2026-09-02 差し戻し H3):
 * `/api/dips/auth/start` の `parseRealmParam` は未知の realm を黙って既定値 `fpl` に
 * フォールバックする (`isDipsRealm` によるガードがあるため安全) が、`realm: string` の
 * ままだと将来別の呼び出し元がガードを経ずに未検証の文字列 (タイポ・新ルート追加時の
 * 実装ミス等) をそのまま渡してもコンパイルが通ってしまい、D1 と同種の無限ログイン
 * ループがビルドを通ったまま再現しうる。`DipsRealm` に絞ることで、`isDipsRealm` 等の
 * 型ガードを経ていない文字列を渡すコードをコンパイル時に検出できるようにする。
 */
export class DipsAuthRequiredError extends Error {
  constructor(readonly realm: DipsRealm) {
    super(`DIPSへのログインが必要です (realm: ${realm})`);
    this.name = "DipsAuthRequiredError";
  }
}

/** ガイドラインはあるが未実装の API を呼び出した (仕様不明ではなく実装未着手) */
export class DipsUnsupportedApiError extends Error {
  constructor(apiName: string) {
    super(`${apiName} は未実装です (ガイドラインは入手済み)`);
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

/**
 * 非冪等な登録系 POST (許可・承認申請受付 / 飛行計画通報受付) がタイムアウトで中断した。
 *
 * `DipsApiClient.request()` の `AbortSignal.timeout()` が発火すると、DIPS 側では申請が
 * 既に受理済みの可能性があるにもかかわらず、通常の `DipsApiError` と同じ「送信に
 * 失敗しました」に丸められてしまい、運用者が再送して共用検証環境DBに重複登録する実害が
 * あった (2026-09-06 レビュー I1)。`DipsApiError` のサブクラスとして区別し、
 * `handleDipsRouteError` が専用の文言 (「受理済みの可能性があります。再送前に確認して
 * ください」) と `possiblyAccepted: true` を返せるようにする。
 */
export class DipsPossiblyAcceptedTimeoutError extends DipsApiError {
  constructor(message: string, cause?: unknown) {
    super(message, undefined, undefined, cause);
    this.name = "DipsPossiblyAcceptedTimeoutError";
  }
}
