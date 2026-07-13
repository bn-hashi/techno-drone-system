import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getProgressService, getCourseAccessService } from "@/lib/serviceFactory";
import { UserRole, UserStatus } from "@/types/prisma";
import { logger } from "@/lib/logger";

export async function GET(
  _request: Request,
  { params }: { params: { courseId: string } }
): Promise<NextResponse> {
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
    // IDOR 対策: 自分の CourseType と一致しないコースは存在秘匿のため 404
    const canAccess = await getCourseAccessService().canAccessCourse(
      session.user.id,
      params.courseId
    );
    if (!canAccess) {
      return NextResponse.json({ error: "Not Found" }, { status: 404 });
    }

    const videos = await getProgressService().getVideosWithLockStatus(
      session.user.id,
      params.courseId
    );
    return NextResponse.json({ videos }, { status: 200 });
  } catch (error) {
    logger.error("コース動画一覧の取得で予期しないエラーが発生しました", error, {
      route: "GET /api/student/courses/[courseId]/videos",
    });
    return NextResponse.json({ error: "内部エラーが発生しました" }, { status: 500 });
  }
}
