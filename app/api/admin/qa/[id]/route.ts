import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getQAService } from "@/lib/serviceFactory";
import { UserRole } from "@/types/prisma";
import { BusinessError, NotFoundError } from "@/services/errors";

interface RouteContext {
  params: Promise<{ id: string }>;
}

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
  const answer = (body as { answer?: unknown })?.answer;
  if (typeof answer !== "string") {
    return NextResponse.json({ error: "answer が必要です" }, { status: 400 });
  }

  const { id } = await context.params;
  // session.user.name は NextAuth デフォルトで authorize の戻り値から継承される
  // フォールバックは「未設定」として運用上識別可能にする
  const answeredBy = session.user.name ?? "未設定";

  try {
    const { record, mailSent } = await getQAService().answerQuestion(id, answer, answeredBy);
    return NextResponse.json({ record, mailSent }, { status: 200 });
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
