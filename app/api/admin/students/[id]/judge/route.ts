import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getJudgmentService } from "@/lib/serviceFactory";
import { UserRole, JudgmentResult } from "@/types/prisma";
import { BusinessError } from "@/services/errors";

interface RouteContext {
  params: Promise<{ id: string }>;
}

const VALID_RESULTS: readonly string[] = [
  JudgmentResult.ACCEPTED,
  JudgmentResult.REJECTED,
];

export async function POST(request: Request, context: RouteContext): Promise<NextResponse> {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!session.user || session.user.role !== UserRole.ADMIN) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "リクエスト本文が不正です" }, { status: 400 });
  }

  const result = (body as { result?: unknown })?.result;
  if (typeof result !== "string" || !VALID_RESULTS.includes(result)) {
    return NextResponse.json(
      { error: "result は ACCEPTED または REJECTED である必要があります" },
      { status: 400 }
    );
  }

  const commentRaw = (body as { comment?: unknown })?.comment;
  const comment = typeof commentRaw === "string" ? commentRaw : undefined;

  const { id } = await context.params;
  // session.user.name は NextAuth デフォルトで authorize の戻り値から継承される
  const judgedBy = session.user.name ?? "未設定";

  try {
    if (result === JudgmentResult.ACCEPTED) {
      const record = await getJudgmentService().judgeAccepted(id, judgedBy, comment);
      return NextResponse.json({ record }, { status: 200 });
    }
    // REJECTED
    const { record, mailSent } = await getJudgmentService().judgeRejected(
      id,
      judgedBy,
      comment
    );
    return NextResponse.json({ record, mailSent }, { status: 200 });
  } catch (err) {
    if (err instanceof BusinessError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    return NextResponse.json({ error: "内部エラーが発生しました" }, { status: 500 });
  }
}
