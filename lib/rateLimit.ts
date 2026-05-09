/**
 * シンプルなインメモリ・スライディングウィンドウ レートリミッター
 *
 * 単一サーバー (Node.js) 向け。複数プロセス / Edge Runtime では使用不可。
 * 15分間に 10回までの試行を許可し、超過した場合は false を返す。
 */

const WINDOW_MS = 15 * 60 * 1000; // 15分
const MAX_ATTEMPTS = 10;

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const store = new Map<string, RateLimitEntry>();

/**
 * 期限切れエントリを store から削除する。
 * checkRateLimit の呼び出し時に毎回実行してメモリを解放する。
 * @param now - 現在時刻 (ms)
 */
function purgeExpiredEntries(now: number): void {
  const expiredKeys: string[] = [];
  store.forEach((entry, key) => {
    if (now > entry.resetAt) {
      expiredKeys.push(key);
    }
  });
  expiredKeys.forEach((key) => store.delete(key));
}

/**
 * 指定されたキーのリクエストが許可されるか判定する。
 *
 * @param key - レート制限のキー (例: `setup-password:192.168.1.1`)
 * @returns 許可される場合 `true`、ウィンドウ内の試行数が上限を超えた場合 `false`
 */
export function checkRateLimit(key: string): boolean {
  const now = Date.now();
  purgeExpiredEntries(now);

  const entry = store.get(key);

  if (!entry || now > entry.resetAt) {
    store.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return true;
  }

  const updatedCount = entry.count + 1;
  store.set(key, { ...entry, count: updatedCount });
  return updatedCount <= MAX_ATTEMPTS;
}
