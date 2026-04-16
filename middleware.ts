import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { determineRedirect } from "@/lib/middlewareHelpers";
import type { TokenPayload } from "@/lib/middlewareHelpers";
import { UserRole, UserStatus } from "@/types/prisma";

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // ログインページは保護されない
  if (pathname === "/login" || pathname.startsWith("/(auth)")) {
    return NextResponse.next();
  }

  // ストレージからトークンを取得
  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET,
  });

  // JWT の role / status フィールドを型付き TokenPayload に変換
  const tokenPayload: TokenPayload | null = token
    ? {
        role: token.role as UserRole,
        status: token.status as UserStatus,
      }
    : null;

  // ルートガード判定
  const redirect = determineRedirect(pathname, tokenPayload);

  if (redirect === "/login") {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * マッチ対象パス
     * - /admin/* (管理画面)
     * - /student/* (受講者画面)
     * 除外: api, _next/static, _next/image, favicon.ico
     */
    "/(admin|student)/:path*",
  ],
};
