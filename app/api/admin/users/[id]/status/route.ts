import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getUserManagementService } from "@/lib/serviceFactory";
import { UserRole, UserStatus } from "@/types/prisma";

const VALID_STATUSES = new Set<string>(Object.values(UserStatus));

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
): Promise<NextResponse> {
  const session = await getServerSession(authOptions);

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (session.user.role !== UserRole.ADMIN) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);

  if (!body || !body.status || !VALID_STATUSES.has(body.status)) {
    return NextResponse.json(
      { error: "status フィールドが不正です" },
      { status: 400 }
    );
  }

  try {
    const user = await getUserManagementService().updateStatus(
      params.id,
      body.status as UserStatus
    );
    return NextResponse.json({ user }, { status: 200 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "";
    if (message.includes("見つかりません")) {
      return NextResponse.json({ error: message }, { status: 404 });
    }
    if (message.includes("無効なステータス遷移")) {
      return NextResponse.json({ error: message }, { status: 400 });
    }
    // 予期しない内部エラーは詳細を露出しない
    return NextResponse.json(
      { error: "内部エラーが発生しました" },
      { status: 500 }
    );
  }
}
