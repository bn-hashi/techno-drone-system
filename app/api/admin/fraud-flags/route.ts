import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getFraudFlagService } from "@/lib/serviceFactory";
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
    const flags = await getFraudFlagService().listAllFlags();
    return NextResponse.json({ success: true, data: flags }, { status: 200 });
  } catch (error: unknown) {
    logger.error("Failed to list fraud flags", error, { route: "GET /api/admin/fraud-flags" });
    return NextResponse.json(
      { success: false, error: "内部エラーが発生しました" },
      { status: 500 }
    );
  }
}
