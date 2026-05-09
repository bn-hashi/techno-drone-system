import { NextResponse } from "next/server";
import { verifyInviteToken } from "@/lib/token";
import { getSetupService } from "@/lib/serviceFactory";

function extractIpAddress(request: Request): string {
  return request.headers.get("x-forwarded-for") ?? "unknown";
}

export async function POST(request: Request): Promise<NextResponse> {
  const body = await request.json().catch(() => null);

  if (!body || typeof body.token !== "string") {
    return NextResponse.json({ error: "token は必須です" }, { status: 400 });
  }

  const payload = verifyInviteToken(body.token);
  if (!payload) {
    return NextResponse.json(
      { error: "トークンが無効または期限切れです" },
      { status: 400 }
    );
  }

  const ipAddress = extractIpAddress(request);

  try {
    await getSetupService().agreeToTerms(payload.userId, ipAddress);
    return NextResponse.json({ success: true }, { status: 200 });
  } catch {
    return NextResponse.json({ error: "内部エラーが発生しました" }, { status: 500 });
  }
}
