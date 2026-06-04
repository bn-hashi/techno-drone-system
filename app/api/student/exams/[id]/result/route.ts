import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getExamService } from "@/lib/serviceFactory";
import { UserRole, UserStatus } from "@/types/prisma";
import { BusinessError, NotFoundError } from "@/services/errors";

interface RouteContext {
  params: Promise<{ id: string }>;
}

// 試験結果を閲覧可能な受講者ステータスの allowlist
// PENDING_* など試験を実施していないステータスは弾く
const ALLOWED_STATUSES: readonly UserStatus[] = [
  UserStatus.ACTIVE,
  UserStatus.EXAM_PASSED,
  UserStatus.COMPLETED,
  UserStatus.CERTIFIED,
  UserStatus.DIPS_LINKED,
];

export async function GET(_request: Request, context: RouteContext): Promise<NextResponse> {
  const session = await getServerSession(authOptions);

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (
    !session.user ||
    session.user.role !== UserRole.STUDENT ||
    !ALLOWED_STATUSES.includes(session.user.status as UserStatus)
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await context.params;

  try {
    const result = await getExamService().getExam(id, session.user.id);
    return NextResponse.json(result, { status: 200 });
  } catch (err) {
    if (err instanceof NotFoundError) {
      return NextResponse.json({ error: err.message }, { status: 404 });
    }
    if (err instanceof BusinessError) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    return NextResponse.json({ error: "内部エラーが発生しました" }, { status: 500 });
  }
}
