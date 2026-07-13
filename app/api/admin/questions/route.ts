import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getQuestionService } from "@/lib/serviceFactory";
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
  const subjectId = searchParams.get("subjectId");

  try {
    const questions = await getQuestionService().listQuestions(
      subjectId ? { subjectId } : undefined
    );
    return NextResponse.json({ questions }, { status: 200 });
  } catch (error) {
    logger.error("問題一覧の取得で予期しないエラーが発生しました", error, {
      route: "GET /api/admin/questions",
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
    typeof body.subjectId !== "string" ||
    typeof body.body !== "string" ||
    !Array.isArray(body.choices) ||
    !Number.isInteger(body.correctIndex) ||
    typeof body.explanation !== "string"
  ) {
    return NextResponse.json({ error: "必須フィールドが不正です" }, { status: 400 });
  }

  try {
    const question = await getQuestionService().createQuestion({
      subjectId: body.subjectId,
      body: body.body,
      choices: body.choices,
      correctIndex: body.correctIndex,
      explanation: body.explanation,
    });
    return NextResponse.json({ question }, { status: 201 });
  } catch (err) {
    if (err instanceof BusinessError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    return NextResponse.json({ error: "内部エラーが発生しました" }, { status: 500 });
  }
}
