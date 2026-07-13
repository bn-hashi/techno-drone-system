import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getProgressService, getUserManagementService } from "@/lib/serviceFactory";
import { UserRole, UserStatus } from "@/types/prisma";
import { logger } from "@/lib/logger";

export async function GET(): Promise<NextResponse> {
  const session = await getServerSession(authOptions);

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (
    !session.user ||
    session.user.role !== UserRole.STUDENT ||
    session.user.status !== UserStatus.ACTIVE
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const user = await getUserManagementService().getUserById(session.user.id);
    if (!user || !user.courseType) {
      return NextResponse.json({ error: "コース未割当です" }, { status: 400 });
    }
    const progress = await getProgressService().getProgressByUser(
      session.user.id,
      user.courseType
    );
    return NextResponse.json({ progress }, { status: 200 });
  } catch (error) {
    logger.error("受講進捗の取得で予期しないエラーが発生しました", error, {
      route: "GET /api/student/progress",
    });
    return NextResponse.json({ error: "内部エラーが発生しました" }, { status: 500 });
  }
}
