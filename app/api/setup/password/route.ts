import { NextResponse } from "next/server";
import { getSetupService } from "@/lib/serviceFactory";
import { BusinessError } from "@/services/errors";
import { checkRateLimit } from "@/lib/rateLimit";

/**
 * リクエストから送信元 IP アドレスを取得する。
 * x-forwarded-for はカンマ区切りのリストになる場合があるため先頭の IP のみ使用する。
 */
function extractIpAddress(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }
  return "unknown";
}

/**
 * パスワード設定エンドポイント
 *
 * 招待トークンを検証し、パスワードをハッシュ化して保存する。
 * IP アドレスごとに 15分間・最大 10回のレート制限を設ける。
 */
export async function POST(request: Request): Promise<NextResponse> {
  const ipAddress = extractIpAddress(request);

  if (!checkRateLimit(`setup-password:${ipAddress}`)) {
    return NextResponse.json(
      { error: "リクエストが多すぎます。しばらくしてから再試行してください。" },
      { status: 429 }
    );
  }

  const body = await request.json().catch(() => null);

  if (!body || typeof body.token !== "string" || typeof body.password !== "string") {
    return NextResponse.json({ error: "token と password は必須です" }, { status: 400 });
  }

  try {
    await getSetupService().setPassword(body.token, body.password);
    return NextResponse.json({ success: true }, { status: 200 });
  } catch (err) {
    if (err instanceof BusinessError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    return NextResponse.json({ error: "内部エラーが発生しました" }, { status: 500 });
  }
}
