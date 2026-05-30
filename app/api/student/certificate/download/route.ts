import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { authOptions } from "@/lib/auth";
import { getCertificateService } from "@/lib/serviceFactory";
import { UserRole, UserStatus } from "@/types/prisma";
import { BusinessError } from "@/services/errors";

export const runtime = "nodejs";

// 修了証明書 DL を許可する受講者ステータスの allowlist
// 発行済 (CERTIFIED) 以降のみ DL 可能
const ALLOWED_STATUSES: readonly UserStatus[] = [
  UserStatus.CERTIFIED,
  UserStatus.DIPS_LINKED,
];

export async function GET(_request: Request): Promise<Response> {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (
    !session.user ||
    session.user.role !== UserRole.STUDENT ||
    !ALLOWED_STATUSES.includes(session.user.status as UserStatus)
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const data = await getCertificateService().getCertificateData(session.user.id);
    if (data.certificate === null) {
      return NextResponse.json(
        { error: "修了証明書がまだ発行されていません" },
        { status: 404 }
      );
    }
    if (data.certificate.pdfPath === null) {
      return NextResponse.json(
        { error: "PDF ファイルが生成されていません。事務局にお問い合わせください。" },
        { status: 409 }
      );
    }

    const buffer = await readFile(data.certificate.pdfPath);
    const filename = path.basename(data.certificate.pdfPath);

    return new Response(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "content-type": "application/pdf",
        "content-disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (err) {
    if (err instanceof BusinessError) {
      return NextResponse.json({ error: err.message }, { status: 404 });
    }
    return NextResponse.json({ error: "内部エラーが発生しました" }, { status: 500 });
  }
}
