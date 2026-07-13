import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getSubjectService } from "@/lib/serviceFactory";
import { UserRole } from "@/types/prisma";
import { logger } from "@/lib/logger";

export async function GET(): Promise<NextResponse> {
  const session = await getServerSession(authOptions);

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!session.user || session.user.role !== UserRole.ADMIN) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const subjects = await getSubjectService().listSubjects();
    return NextResponse.json({ subjects }, { status: 200 });
  } catch (error) {
    logger.error("科目一覧の取得で予期しないエラーが発生しました", error, {
      route: "GET /api/admin/subjects",
    });
    return NextResponse.json({ error: "内部エラーが発生しました" }, { status: 500 });
  }
}
