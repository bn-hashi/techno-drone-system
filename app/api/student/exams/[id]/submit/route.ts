import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getExamService } from "@/lib/serviceFactory";
import { UserRole, UserStatus } from "@/types/prisma";
import { BusinessError, NotFoundError } from "@/services/errors";
import type { SubmitAnswerInput } from "@/services/examService";

interface RouteContext {
  params: Promise<{ id: string }>;
}

interface RawAnswer {
  questionId?: unknown;
  selectedIndex?: unknown;
}

function parseAnswers(input: unknown): SubmitAnswerInput[] | null {
  if (!Array.isArray(input)) return null;
  const result: SubmitAnswerInput[] = [];
  for (const item of input as RawAnswer[]) {
    if (
      !item ||
      typeof item.questionId !== "string" ||
      !Number.isInteger(item.selectedIndex)
    ) {
      return null;
    }
    result.push({
      questionId: item.questionId,
      selectedIndex: item.selectedIndex as number,
    });
  }
  return result;
}

export async function POST(request: Request, context: RouteContext): Promise<NextResponse> {
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
  const answers = parseAnswers(body?.answers);
  if (answers === null) {
    return NextResponse.json({ error: "回答の形式が不正です" }, { status: 400 });
  }

  const { id } = await context.params;

  try {
    const exam = await getExamService().submitExam(session.user.id, id, answers);
    return NextResponse.json({ exam }, { status: 200 });
  } catch (err) {
    if (err instanceof NotFoundError) {
      return NextResponse.json({ error: err.message }, { status: 404 });
    }
    if (err instanceof BusinessError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    return NextResponse.json({ error: "内部エラーが発生しました" }, { status: 500 });
  }
}
