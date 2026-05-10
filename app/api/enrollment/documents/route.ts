import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getEnrollmentService } from "@/lib/serviceFactory";
import { UserRole } from "@/types/prisma";
import { BusinessError, EnrollmentNotFoundError } from "@/services/errors";
import type { DocumentFieldName } from "@/services/enrollmentService";

// ドキュメントフィールド名とアップロード先サブディレクトリのマッピング
// Controller はファイルの抽出のみ行い、保存・DB更新は Service に委譲する
const DOCUMENT_FIELD_NAMES: DocumentFieldName[] = ["idDocument", "photo", "experienceCert"];

export async function POST(request: Request): Promise<NextResponse> {
  const session = await getServerSession(authOptions);

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!session.user || session.user.role !== UserRole.STUDENT) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const userId = session.user.id;
  const formData = await request.formData();

  // フォームデータからファイルエントリを抽出する（Controller の責務はここまで）
  // 空チェックは Service 層の BusinessError に委譲する
  const fileEntries = DOCUMENT_FIELD_NAMES.flatMap((field) => {
    const entry = formData.get(field);
    if (!(entry instanceof File)) return [];
    return [{ field, file: entry }];
  });

  try {
    const service = getEnrollmentService();
    await service.uploadDocuments(userId, fileEntries);
    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    if (error instanceof BusinessError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    if (error instanceof EnrollmentNotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    return NextResponse.json({ error: "内部サーバーエラーが発生しました" }, { status: 500 });
  }
}
