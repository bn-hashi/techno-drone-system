import NextAuth from "next-auth";
import { authOptions } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rateLimit";
import { extractIpAddress } from "@/lib/ipAddress";
import { NextRequest, NextResponse } from "next/server";

const nextAuthHandler = NextAuth(authOptions);

// GET はレートリミット不要（セッション取得など）
export { nextAuthHandler as GET };

// POST は credentials 認証を含むためブルートフォース対策を適用する。
// Route Handler は Node.js ランタイムで実行されるため、
// インメモリ store が確実にリクエスト間で保持される。
export async function POST(req: NextRequest, ctx: { params: { nextauth: string[] } }) {
  if (ctx.params.nextauth.join("/") === "callback/credentials") {
    const ip = extractIpAddress(req);
    if (!checkRateLimit(ip)) {
      return new NextResponse("Too Many Requests", { status: 429 });
    }
  }
  return nextAuthHandler(req, ctx);
}

export const dynamic = "force-dynamic";
