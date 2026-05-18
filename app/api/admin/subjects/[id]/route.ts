import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getSubjectService } from "@/lib/serviceFactory";
import { UserRole } from "@/types/prisma";
import { SubjectNotFoundError, BusinessError } from "@/services/errors";

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
): Promise<NextResponse> {
  const session = await getServerSession(authOptions);

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!session.user || session.user.role !== UserRole.ADMIN) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);

  if (
    !body ||
    typeof body.beginner !== "number" ||
    !Number.isInteger(body.beginner) ||
    typeof body.experienced !== "number" ||
    !Number.isInteger(body.experienced)
  ) {
    return NextResponse.json(
      { error: "beginner と experienced は整数で指定してください" },
      { status: 400 }
    );
  }

  try {
    const subject = await getSubjectService().updateRequiredMinutes(
      params.id,
      body.beginner,
      body.experienced
    );
    return NextResponse.json({ subject }, { status: 200 });
  } catch (err) {
    if (err instanceof SubjectNotFoundError) {
      return NextResponse.json({ error: err.message }, { status: 404 });
    }
    if (err instanceof BusinessError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    return NextResponse.json({ error: "内部エラーが発生しました" }, { status: 500 });
  }
}
