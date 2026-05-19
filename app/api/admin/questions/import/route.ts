import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getQuestionService } from "@/lib/serviceFactory";
import { UserRole } from "@/types/prisma";
import { BusinessError } from "@/services/errors";

/**
 * CSV 一括インポート。
 * 本文は text/csv で受け取る (multipart は使わない)。
 * Service 層が all-or-nothing トランザクションを管理するため、エラー時は
 * 行番号付きメッセージを 400 で返す。
 */
export async function POST(request: Request): Promise<NextResponse> {
  const session = await getServerSession(authOptions);

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!session.user || session.user.role !== UserRole.ADMIN) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const csvText = await request.text();

  try {
    const result = await getQuestionService().importFromCsv(csvText);
    return NextResponse.json(result, { status: 200 });
  } catch (err) {
    if (err instanceof BusinessError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    return NextResponse.json({ error: "内部エラーが発生しました" }, { status: 500 });
  }
}
