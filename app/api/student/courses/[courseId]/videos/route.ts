import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getProgressService } from "@/lib/serviceFactory";
import { UserRole, UserStatus } from "@/types/prisma";

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
    const videos = await getProgressService().getVideosWithLockStatus(
      session.user.id,
      params.courseId
    );
    return NextResponse.json({ videos }, { status: 200 });
  } catch {
    return NextResponse.json({ error: "内部エラーが発生しました" }, { status: 500 });
  }
}
