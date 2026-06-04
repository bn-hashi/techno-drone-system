import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getVideoService } from "@/lib/serviceFactory";
import { UserRole } from "@/types/prisma";
import { SupervisorNotFoundError, BusinessError } from "@/services/errors";

export async function PATCH(
  request: Request,
  { params }: { params: { id: string; supervisorId: string } }
): Promise<NextResponse> {
  const session = await getServerSession(authOptions);

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!session.user || session.user.role !== UserRole.ADMIN) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);

  if (!body) {
    return NextResponse.json({ error: "リクエストボディが不正です" }, { status: 400 });
  }

  try {
    const supervisor = await getVideoService().updateSupervisor(params.id, params.supervisorId, {
      name: body.name,
      instructorRegistrationNumber: body.instructorRegistrationNumber,
    });
    return NextResponse.json({ supervisor }, { status: 200 });
  } catch (err) {
    if (err instanceof SupervisorNotFoundError) {
      return NextResponse.json({ error: err.message }, { status: 404 });
    }
    if (err instanceof BusinessError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    return NextResponse.json({ error: "内部エラーが発生しました" }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: { id: string; supervisorId: string } }
): Promise<NextResponse> {
  const session = await getServerSession(authOptions);

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!session.user || session.user.role !== UserRole.ADMIN) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    await getVideoService().removeSupervisor(params.id, params.supervisorId);
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    if (err instanceof SupervisorNotFoundError) {
      return NextResponse.json({ error: err.message }, { status: 404 });
    }
    if (err instanceof BusinessError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    return NextResponse.json({ error: "内部エラーが発生しました" }, { status: 500 });
  }
}
