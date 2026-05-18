import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getFraudFlagService } from "@/lib/serviceFactory";
import { UserRole, UserStatus, FraudFlagType } from "@/types/prisma";
import { BusinessError } from "@/services/errors";

const VALID_TYPES = new Set<string>(Object.values(FraudFlagType));

export async function POST(request: Request): Promise<NextResponse> {
  const session = await getServerSession(authOptions);

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (
    !session.user ||
    session.user.role !== UserRole.STUDENT ||
    session.user.status !== UserStatus.ACTIVE
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body.type !== "string" || !VALID_TYPES.has(body.type)) {
    return NextResponse.json({ error: "type が不正です" }, { status: 400 });
  }
  if (!Number.isFinite(body.durationSeconds)) {
    return NextResponse.json({ error: "durationSeconds が不正です" }, { status: 400 });
  }

  try {
    if (body.type === FraudFlagType.TAB_LEAVE) {
      const flag = await getFraudFlagService().flagTabLeave(
        session.user.id,
        body.durationSeconds
      );
      return NextResponse.json({ flag }, { status: 201 });
    }
    return NextResponse.json({ error: "未対応の type です" }, { status: 400 });
  } catch (err) {
    if (err instanceof BusinessError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    return NextResponse.json({ error: "内部エラーが発生しました" }, { status: 500 });
  }
}
