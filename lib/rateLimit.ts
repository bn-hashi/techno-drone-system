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
 * 指定されたキー（IPアドレスなど）のリクエストが許可されるか判定する。
 * @returns 許可される場合 true、レート超過の場合 false
 */
/**
 * 期限切れエントリを store から削除する。
 * checkRateLimit の呼び出し時に毎回実行してメモリを解放する。
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

export function checkRateLimit(key: string): boolean {
  const now = Date.now();
  purgeExpiredEntries(now);

  const entry = store.get(key);

  if (!entry || now > entry.resetAt) {
    store.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return true;
  }

  entry.count++;
  return entry.count <= MAX_ATTEMPTS;
}
