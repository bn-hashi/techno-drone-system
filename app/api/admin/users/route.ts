import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getUserManagementService } from "@/lib/serviceFactory";
import { UserRole, UserStatus, CourseType } from "@/types/prisma";
import { BusinessError, DuplicateEmailError } from "@/services/errors";

const VALID_STATUSES = new Set<string>(Object.values(UserStatus));
const VALID_COURSE_TYPES = new Set<string>(Object.values(CourseType));

export async function GET(request: Request): Promise<NextResponse> {
  const session = await getServerSession(authOptions);

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!session.user || session.user.role !== UserRole.ADMIN) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const statusParam = searchParams.get("status");

  if (statusParam !== null && !VALID_STATUSES.has(statusParam)) {
    return NextResponse.json({ error: "無効なステータス値です" }, { status: 400 });
  }

  const filter = statusParam ? { status: statusParam as UserStatus } : undefined;

  try {
    const users = await getUserManagementService().listUsers(filter);
    return NextResponse.json({ users }, { status: 200 });
  } catch {
    return NextResponse.json({ error: "内部エラーが発生しました" }, { status: 500 });
  }
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
    typeof body.email !== "string" ||
    typeof body.name !== "string" ||
    typeof body.password !== "string" ||
    !VALID_COURSE_TYPES.has(body.courseType)
  ) {
    return NextResponse.json({ error: "必須フィールドが不正です" }, { status: 400 });
  }

  try {
    const user = await getUserManagementService().createUser({
      email: body.email,
      name: body.name,
      password: body.password,
      courseType: body.courseType as CourseType,
    });
    return NextResponse.json({ user }, { status: 201 });
  } catch (err) {
    if (err instanceof DuplicateEmailError) {
      return NextResponse.json({ error: err.message }, { status: 409 });
    }
    if (err instanceof BusinessError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    // 予期しない内部エラーは詳細を露出しない
    return NextResponse.json({ error: "内部エラーが発生しました" }, { status: 500 });
  }
}
