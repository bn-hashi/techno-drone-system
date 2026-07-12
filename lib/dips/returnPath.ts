/**
 * DIPS 認可コードフロー完了後の戻り先パスのバリデータ
 *
 * オープンリダイレクト対策として、/flight/ 配下のアプリ内パスのみを許可する。
 * cookie やクエリパラメータ経由で受け取る値は攻撃者が操作できるため、
 * 保存時と読み出し時の両方で必ずこの関数を通すこと。
 */

// cuid / UUID / スラッグを想定した保守的な許可文字セット。
// ドット (.) を一切許可しないことでパストラバーサル (..) を構造的に排除し、
// パーセント (%) を許可しないことでエンコード済みトラバーサルも排除する。
// クエリ (?)・フラグメント (#) は、リダイレクト時に ?dips=... を安全に
// 付与できるよう許可しない。
const SAFE_FLIGHT_PATH_PATTERN = /^\/flight(?:\/[A-Za-z0-9_-]+)+$/;

// 正常な戻り先パス (例: /flight/plans/<cuid>) には十分な長さの上限
const MAX_RETURN_PATH_LENGTH = 512;

/** 値が DIPS 認可後の戻り先として安全なアプリ内パスかを検証する */
export function isSafeInternalReturnPath(path: string | null | undefined): path is string {
  if (typeof path !== "string") return false;
  if (path.length === 0 || path.length > MAX_RETURN_PATH_LENGTH) return false;
  return SAFE_FLIGHT_PATH_PATTERN.test(path);
}
