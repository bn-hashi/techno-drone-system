import { NextResponse } from "next/server";
import { verifyInviteToken } from "@/lib/token";
import { getSetupService } from "@/lib/serviceFactory";
import { checkRateLimit } from "@/lib/rateLimit";
import { extractIpAddress } from "@/lib/ipAddress";

/**
 * 受講規約同意エンドポイント
 *
 * トークンを検証し、同意ログを記録してユーザーステータスを ACTIVE に更新する。
 * IP アドレスごとに 15分間・最大 10回のレート制限を設ける。
 */
export async function POST(request: Request): Promise<NextResponse> {
  const ipAddress = extractIpAddress(request);

  if (!checkRateLimit(`setup-agreement:${ipAddress}`)) {
    return NextResponse.json(
      { error: "リクエストが多すぎます。しばらくしてから再試行してください。" },
      { status: 429 }
    );
  }

  const body = await request.json().catch(() => null);

  if (!body || typeof body.token !== "string") {
    return NextResponse.json({ error: "token は必須です" }, { status: 400 });
  }

  const payload = verifyInviteToken(body.token);
  if (!payload) {
    return NextResponse.json({ error: "トークンが無効または期限切れです" }, { status: 400 });
  }

  try {
    await getSetupService().agreeToTerms(payload.userId, ipAddress);
    return NextResponse.json({ success: true }, { status: 200 });
  } catch {
    return NextResponse.json({ error: "内部エラーが発生しました" }, { status: 500 });
  }
}
