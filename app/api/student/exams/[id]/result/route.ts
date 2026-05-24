import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getExamService } from "@/lib/serviceFactory";
import { UserRole } from "@/types/prisma";
import { BusinessError, NotFoundError } from "@/services/errors";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(_request: Request, context: RouteContext): Promise<NextResponse> {
  const session = await getServerSession(authOptions);

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  // 結果は ACTIVE / EXAM_PASSED / COMPLETED / CERTIFIED など STUDENT であれば閲覧可
  if (!session.user || session.user.role !== UserRole.STUDENT) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await context.params;

  try {
    const result = await getExamService().getExam(id, session.user.id);
    return NextResponse.json(result, { status: 200 });
  } catch (err) {
    if (err instanceof NotFoundError) {
      return NextResponse.json({ error: err.message }, { status: 404 });
    }
    if (err instanceof BusinessError) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    return NextResponse.json({ error: "内部エラーが発生しました" }, { status: 500 });
  }
}
