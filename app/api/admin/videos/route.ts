import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getVideoService } from "@/lib/serviceFactory";
import { UserRole } from "@/types/prisma";
import { BusinessError } from "@/services/errors";
import { logger } from "@/lib/logger";

export async function GET(request: Request): Promise<NextResponse> {
  const session = await getServerSession(authOptions);

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!session.user || session.user.role !== UserRole.ADMIN) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const filter: { courseId?: string; subjectId?: string; isPublished?: boolean } = {};

  const courseId = searchParams.get("courseId");
  if (courseId !== null) filter.courseId = courseId;

  const subjectId = searchParams.get("subjectId");
  if (subjectId !== null) filter.subjectId = subjectId;

  const isPublishedParam = searchParams.get("isPublished");
  if (isPublishedParam !== null) {
    if (isPublishedParam !== "true" && isPublishedParam !== "false") {
      return NextResponse.json(
        { error: "isPublished には true または false を指定してください" },
        { status: 400 }
      );
    }
    filter.isPublished = isPublishedParam === "true";
  }

  try {
    const videos = await getVideoService().listVideos(
      Object.keys(filter).length > 0 ? filter : undefined
    );
    return NextResponse.json({ videos }, { status: 200 });
  } catch (error) {
    logger.error("動画一覧の取得で予期しないエラーが発生しました", error, {
      route: "GET /api/admin/videos",
    });
    return NextResponse.json({ error: "内部エラーが発生しました" }, { status: 500 });
  }
}

export async function POST(request: Request): Promise<NextResponse> {
  const session = await getServerSession(authOptions);

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!session.user || session.user.role !== UserRole.ADMIN) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);

  if (
    !body ||
    typeof body.title !== "string" ||
    typeof body.filePath !== "string" ||
    !Number.isInteger(body.duration)
  ) {
    return NextResponse.json({ error: "必須フィールドが不正です" }, { status: 400 });
  }

  try {
    const video = await getVideoService().createVideo({
      title: body.title,
      description: body.description,
      subjectId: body.subjectId,
      courseId: body.courseId,
      filePath: body.filePath,
      duration: body.duration,
      sortOrder: body.sortOrder,
    });
    return NextResponse.json({ video }, { status: 201 });
  } catch (err) {
    if (err instanceof BusinessError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    logger.error("動画の作成で予期しないエラーが発生しました", err, {
      route: "POST /api/admin/videos",
    });
    return NextResponse.json({ error: "内部エラーが発生しました" }, { status: 500 });
  }
}
