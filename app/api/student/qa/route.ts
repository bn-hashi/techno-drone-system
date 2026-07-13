import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getQAService } from "@/lib/serviceFactory";
import { UserRole, UserStatus } from "@/types/prisma";
import { BusinessError } from "@/services/errors";
import { logger } from "@/lib/logger";

// QA を利用できる受講者ステータスの allowlist
// PENDING_* など受講開始前のステータスは弾く
const ALLOWED_STATUSES: readonly UserStatus[] = [
  UserStatus.ACTIVE,
  UserStatus.EXAM_PASSED,
  UserStatus.COMPLETED,
  UserStatus.CERTIFIED,
  UserStatus.DIPS_LINKED,
];

export async function POST(request: Request): Promise<NextResponse> {
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

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "リクエスト本文が不正です" }, { status: 400 });
  }
  const question = (body as { question?: unknown })?.question;
  if (typeof question !== "string") {
    return NextResponse.json({ error: "question が必要です" }, { status: 400 });
  }

  try {
    const record = await getQAService().createQuestion(session.user.id, question);
    return NextResponse.json({ record }, { status: 201 });
  } catch (err) {
    if (err instanceof BusinessError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    logger.error("質問の投稿で予期しないエラーが発生しました", err, {
      route: "POST /api/student/qa",
    });
    return NextResponse.json({ error: "内部エラーが発生しました" }, { status: 500 });
  }
}

export async function GET(_request: Request): Promise<NextResponse> {
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

  try {
    const records = await getQAService().listByUser(session.user.id);
    return NextResponse.json({ records }, { status: 200 });
  } catch (error) {
    logger.error("質問履歴の取得で予期しないエラーが発生しました", error, {
      route: "GET /api/student/qa",
    });
    return NextResponse.json({ error: "内部エラーが発生しました" }, { status: 500 });
  }
}
