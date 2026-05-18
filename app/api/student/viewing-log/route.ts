import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getViewingLogService } from "@/lib/serviceFactory";
import { UserRole, UserStatus } from "@/types/prisma";
import { BusinessError, VideoNotFoundError } from "@/services/errors";

function parseIsoDate(value: unknown): Date | null {
  if (typeof value !== "string") return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export async function POST(request: Request): Promise<NextResponse> {
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

  const body = await request.json().catch(() => null);
  if (!body || typeof body.videoId !== "string") {
    return NextResponse.json({ error: "必須フィールドが不正です" }, { status: 400 });
  }
  if (!Number.isFinite(body.watchedSeconds)) {
    return NextResponse.json({ error: "watchedSeconds が不正です" }, { status: 400 });
  }
  const startedAt = parseIsoDate(body.startedAt);
  const endedAt = parseIsoDate(body.endedAt);
  if (startedAt === null || endedAt === null) {
    return NextResponse.json({ error: "日時の形式が不正です" }, { status: 400 });
  }

  try {
    const log = await getViewingLogService().recordSession({
      userId: session.user.id,
      videoId: body.videoId,
      startedAt,
      endedAt,
      watchedSeconds: body.watchedSeconds,
      rawLog: body.rawLog,
    });
    return NextResponse.json({ log }, { status: 201 });
  } catch (err) {
    if (err instanceof VideoNotFoundError) {
      return NextResponse.json({ error: err.message }, { status: 404 });
    }
    if (err instanceof BusinessError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    return NextResponse.json({ error: "内部エラーが発生しました" }, { status: 500 });
  }
}
