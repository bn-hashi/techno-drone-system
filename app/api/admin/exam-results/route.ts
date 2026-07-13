import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getExamService } from "@/lib/serviceFactory";
import { UserRole } from "@/types/prisma";
import { logger } from "@/lib/logger";

export async function GET(_request: Request): Promise<NextResponse> {
  const session = await getServerSession(authOptions);

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!session.user || session.user.role !== UserRole.ADMIN) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const examResults = await getExamService().listAllResults();
    return NextResponse.json({ examResults }, { status: 200 });
  } catch (error) {
    logger.error("試験結果一覧の取得で予期しないエラーが発生しました", error, {
      route: "GET /api/admin/exam-results",
    });
    return NextResponse.json({ error: "内部エラーが発生しました" }, { status: 500 });
  }
}
