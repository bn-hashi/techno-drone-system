import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { UserRole } from "@/types/prisma";
import { hasFlightAccess } from "@/lib/auth/flightPermissions";

type FlightAccessResult =
  | { ok: true; userId: string; isAdmin: boolean }
  | { ok: false; response: NextResponse };

/** 飛行管理 API ルート共通の認可チェック。未認可の場合はそのまま返せる NextResponse を含める */
export async function requireFlightAccess(): Promise<FlightAccessResult> {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return { ok: false, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  const role = session.user.role as UserRole;
  if (!hasFlightAccess(role)) {
    return { ok: false, response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { ok: true, userId: session.user.id, isAdmin: role === UserRole.ADMIN };
}
