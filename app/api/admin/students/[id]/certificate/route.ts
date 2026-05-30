import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getCertificateService } from "@/lib/serviceFactory";
import { UserRole } from "@/types/prisma";
import { BusinessError } from "@/services/errors";

// @react-pdf/renderer + Font.register は Node.js ランタイム専用
export const runtime = "nodejs";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(_request: Request, context: RouteContext): Promise<NextResponse> {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!session.user || session.user.role !== UserRole.ADMIN) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await context.params;

  try {
    const result = await getCertificateService().issueCertificate(id);
    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    if (err instanceof BusinessError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    return NextResponse.json({ error: "内部エラーが発生しました" }, { status: 500 });
  }
}
