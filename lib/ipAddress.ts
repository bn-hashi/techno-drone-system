/**
 * リクエストから送信元 IP アドレスを取得する。
 *
 * x-forwarded-for はカンマ区切りのリストになる場合があるため先頭の IP のみ使用する。
 * プロキシ・ロードバランサーを経由しない直接リクエストの場合は "unknown" を返す。
 *
 * @param request - Next.js API Route の Request オブジェクト
 * @returns クライアント IP アドレス文字列、取得できない場合は "unknown"
 */
export function extractIpAddress(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }
  return "unknown";
}
