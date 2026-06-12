import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getEnrollmentService } from "@/lib/serviceFactory";
import { UserRole } from "@/types/prisma";
import { BusinessError, DuplicateEnrollmentError, UserNotFoundError } from "@/services/errors";

export async function GET(): Promise<NextResponse> {
  const session = await getServerSession(authOptions);

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!session.user || session.user.role !== UserRole.ADMIN) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const applications = await getEnrollmentService().listEnrollments();
  return NextResponse.json({ applications }, { status: 200 });
}

export async function POST(request: Request): Promise<NextResponse> {
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
    typeof body.userId !== "string" ||
    typeof body.dateOfBirth !== "string" ||
    typeof body.address !== "string" ||
    typeof body.phoneNumber !== "string"
  ) {
    return NextResponse.json({ error: "必須フィールドが不正です" }, { status: 400 });
  }

  const dateOfBirth = new Date(body.dateOfBirth);
  if (isNaN(dateOfBirth.getTime())) {
    return NextResponse.json({ error: "生年月日の形式が不正です" }, { status: 400 });
  }

  try {
    const application = await getEnrollmentService().createEnrollment({
      userId: body.userId,
      dateOfBirth,
      address: body.address,
      phoneNumber: body.phoneNumber,
    });
    return NextResponse.json({ application }, { status: 201 });
  } catch (err) {
    if (err instanceof DuplicateEnrollmentError) {
      return NextResponse.json({ error: err.message }, { status: 409 });
    }
    if (err instanceof UserNotFoundError) {
      return NextResponse.json({ error: err.message }, { status: 404 });
    }
    if (err instanceof BusinessError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    return NextResponse.json({ error: "内部エラーが発生しました" }, { status: 500 });
  }
}
