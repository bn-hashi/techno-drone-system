import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getQAService } from "@/lib/serviceFactory";
import { UserRole } from "@/types/prisma";
import { logger } from "@/lib/logger";

export async function GET(request: Request): Promise<NextResponse> {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!session.user || session.user.role !== UserRole.ADMIN) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(request.url);
  const unansweredOnly = url.searchParams.get("unansweredOnly") === "true";

  try {
    const records = await getQAService().listAll(unansweredOnly);
    return NextResponse.json({ records }, { status: 200 });
  } catch (error) {
    logger.error("質疑応答一覧の取得で予期しないエラーが発生しました", error, {
      route: "GET /api/admin/qa",
    });
    return NextResponse.json({ error: "内部エラーが発生しました" }, { status: 500 });
  }
}
