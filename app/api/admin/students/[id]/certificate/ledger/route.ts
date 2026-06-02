import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getCertificateLedgerService } from "@/lib/serviceFactory";
import { UserRole } from "@/types/prisma";
import { BusinessError } from "@/services/errors";

// @react-pdf/renderer は Node ランタイム専用
export const runtime = "nodejs";

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * 管理者向け: 指定受講者の様式5 (修了証明書交付台帳) PDF をダウンロードする。
 * 台帳は永続化せず、リクエストのたびに発行済み証明書から生成する。
 */
export async function GET(_request: Request, context: RouteContext): Promise<Response> {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!session.user || session.user.role !== UserRole.ADMIN) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await context.params;

  try {
    const buffer = await getCertificateLedgerService().getLedgerPdf(id);
    // content-disposition ヘッダ注入を防ぐため、ファイル名は ASCII 英数字のみに正規化する
    const safeId = id.replace(/[^A-Za-z0-9_-]/g, "");
    const filename = `certificate-ledger-${safeId || "unknown"}.pdf`;
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
