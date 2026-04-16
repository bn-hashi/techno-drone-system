import { UserRole } from "@/types/prisma";

export interface TokenPayload {
  role: UserRole;
}

/**
 * ミドルウェアのルートガード判定を行う純粋関数
 * Edge Runtime 対応のため、全ロジックを pure function で実装
 *
 * @param pathname - リクエストパス
 * @param token - JWT トークンペイロード (null の場合は未認証)
 * @returns "allow" の場合はアクセス許可、"/login" の場合はリダイレクト
 */
export function determineRedirect(
  pathname: string,
  token: TokenPayload | null
): "allow" | "/login" {
  // トークンなしの場合は全てのプロテクトルートをブロック
  if (!token) {
    return "/login";
  }

  // ロールベースのアクセス制御
  // startsWith("/admin") ではなく正規表現を使い /administrator などの誤マッチを防ぐ
  if (/^\/admin(\/|$)/.test(pathname)) {
    return token.role === UserRole.ADMIN ? "allow" : "/login";
  }

  if (/^\/student(\/|$)/.test(pathname)) {
    return token.role === UserRole.STUDENT ? "allow" : "/login";
  }

  // その他のパス（通常はプロテクトされていない）
  return "allow";
}
