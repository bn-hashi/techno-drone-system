import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  getViewingLogService,
  getVideoService,
  getCourseAccessService,
  getProgressService,
} from "@/lib/serviceFactory";
import { UserRole, UserStatus } from "@/types/prisma";
import { BusinessError, VideoNotFoundError } from "@/services/errors";

// YYYY-MM-DDTHH:mm:ss(.sss)Z 厳格パターン（UTC のみ許可）
const ISO_UTC_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/;

function parseIsoDate(value: unknown): Date | null {
  if (typeof value !== "string") return null;
  if (!ISO_UTC_PATTERN.test(value)) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  // new Date は "2026-02-30" を 3/2 に繰り越すため、入力と一致するか再検証
  if (date.toISOString().slice(0, 19) !== value.slice(0, 19)) return null;
  return date;
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
    // IDOR 対策: videoId から動画を解決し、自分の CourseType と一致するコースか確認する。
    // 存在しない動画も認可されないコースの動画も、存在秘匿のため 404 を返す。
    const video = await getVideoService().getVideo(body.videoId);
    const canAccess = await getCourseAccessService().canAccessCourse(
      session.user.id,
      video.courseId
    );
    if (!canAccess) {
      return NextResponse.json({ error: "Not Found" }, { status: 404 });
    }

    // 未公開動画・順番視聴ロック: 存在秘匿のため 404
    if (!video.isPublished) {
      return NextResponse.json({ error: "Not Found" }, { status: 404 });
    }
    const canWatch = await getProgressService().canWatchVideo(session.user.id, video.id);
    if (!canWatch) {
      return NextResponse.json({ error: "Not Found" }, { status: 404 });
    }

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
      return NextResponse.json({ error: "Not Found" }, { status: 404 });
    }
    if (err instanceof BusinessError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    return NextResponse.json({ error: "内部エラーが発生しました" }, { status: 500 });
  }
}
