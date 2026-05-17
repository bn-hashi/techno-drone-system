import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getVideoService } from "@/lib/serviceFactory";
import { UserRole } from "@/types/prisma";
import { VideoNotFoundError, BusinessError } from "@/services/errors";

export async function POST(
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
    typeof body.name !== "string" ||
    typeof body.instructorRegistrationNumber !== "string"
  ) {
    return NextResponse.json({ error: "必須フィールドが不正です" }, { status: 400 });
  }

  try {
    const supervisor = await getVideoService().addSupervisor(params.id, {
      name: body.name,
      instructorRegistrationNumber: body.instructorRegistrationNumber,
    });
    return NextResponse.json({ supervisor }, { status: 201 });
  } catch (err) {
    if (err instanceof VideoNotFoundError) {
      return NextResponse.json({ error: err.message }, { status: 404 });
    }
    if (err instanceof BusinessError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    return NextResponse.json({ error: "内部エラーが発生しました" }, { status: 500 });
  }
}
