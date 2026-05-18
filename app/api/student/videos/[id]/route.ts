import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getVideoService, getViewingLogService } from "@/lib/serviceFactory";
import { UserRole, UserStatus } from "@/types/prisma";
import { VideoNotFoundError } from "@/services/errors";

export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
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
    const video = await getVideoService().getVideo(params.id);
    if (!video.isPublished) {
      return NextResponse.json({ error: "動画が見つかりません" }, { status: 404 });
    }
    const maxWatchedSeconds = await getViewingLogService().getMaxWatchedSeconds(
      session.user.id,
      video.id
    );
    return NextResponse.json({ video, maxWatchedSeconds }, { status: 200 });
  } catch (err) {
    if (err instanceof VideoNotFoundError) {
      return NextResponse.json({ error: err.message }, { status: 404 });
    }
    return NextResponse.json({ error: "内部エラーが発生しました" }, { status: 500 });
  }
}
