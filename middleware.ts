import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { determineRedirect } from "@/lib/middlewareHelpers";
import type { TokenPayload } from "@/lib/middlewareHelpers";
import { isValidUserRole, isValidUserStatus } from "@/lib/authHelpers";
import { isAppBaseUrlConfigured, APP_BASE_URL_MISSING_ERROR } from "@/lib/appBaseUrl";

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // ログインページは保護されない
  if (pathname === "/login") {
    return NextResponse.next();
  }

  // ブルートフォース対策は /api/auth/[...nextauth]/route.ts の POST ハンドラで実施
  // (Node.js ランタイム確実なインメモリ store を使用)

  // ストレージからトークンを取得
  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET,
  });

  // JWT の role / status フィールドを型ガードで検証して TokenPayload に変換
  // 無効なペイロードは null として扱い、再ログインを強制する
  const tokenPayload: TokenPayload | null = (() => {
    if (!token) return null;
    if (!isValidUserRole(token.role) || !isValidUserStatus(token.status)) return null;
    return { role: token.role, status: token.status };
  })();

  // ルートガード判定
  const redirect = determineRedirect(pathname, tokenPayload);

  if (redirect === "/login") {
    // request.url reflects the app's own bind address (localhost:3000) behind a
    // reverse proxy under `next start`, so build the redirect from APP_BASE_URL instead.
    // APP_BASE_URL 未設定のまま new URL() を呼ぶと Invalid URL で例外化するため、
    // ここで明示的に 500 を返す。
    if (!isAppBaseUrlConfigured()) {
      return NextResponse.json({ error: APP_BASE_URL_MISSING_ERROR }, { status: 500 });
    }
    return NextResponse.redirect(new URL("/login", process.env.APP_BASE_URL));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * マッチ対象パス
     * - /admin/* (管理画面)
     * - /student/* (受講者画面)
     * 除外: _next/static, _next/image, favicon.ico
     */
    "/(admin|student)/:path*",
  ],
};
