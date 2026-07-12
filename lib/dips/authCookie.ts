/** DIPS 認可コードフローの state 照合用 nonce を保持する cookie 名 */
export const DIPS_STATE_COOKIE_NAME = "dips_auth_state";

/** 認可完了後の戻り先パスを保持する cookie 名 (値は isSafeInternalReturnPath 検証済みのみ) */
export const DIPS_RETURN_COOKIE_NAME = "dips_auth_return";

/** nonce / 戻り先 cookie の有効期間 (秒)。認可フロー完了までの短時間で十分 */
export const DIPS_STATE_COOKIE_MAX_AGE = 600;
