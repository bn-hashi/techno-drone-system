import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getSetupService } from "@/lib/serviceFactory";
import { UserRole } from "@/types/prisma";
import { NotFoundError } from "@/services/errors";

/**
 * 招待メール送信エンドポイント（管理者専用）
 *
 * 管理者が受講者に対してパスワード設定用の招待メールを送信する。
 * ADMIN ロール以外のアクセスは 403 を返す。
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const session = await getServerSession(authOptions);

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!session.user || session.user.role !== UserRole.ADMIN) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  // APP_BASE_URL は必須。未設定の場合は Host ヘッダ偽装のリスクがあるため 500 を返す。
  const baseUrl = process.env.APP_BASE_URL;
  if (!baseUrl) {
    return NextResponse.json(
      { error: "サーバー設定エラー: APP_BASE_URL が未設定です" },
      { status: 500 }
    );
  }

  try {
    await getSetupService().sendInviteEmail(id, baseUrl);
    return NextResponse.json({ success: true }, { status: 200 });
  } catch (err) {
    if (err instanceof NotFoundError) {
      return NextResponse.json({ error: err.message }, { status: 404 });
    }
    return NextResponse.json({ error: "内部エラーが発生しました" }, { status: 500 });
  }
}
