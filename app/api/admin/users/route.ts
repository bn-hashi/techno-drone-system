import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { UserRepository } from "@/repositories/userRepository";
import { UserManagementService } from "@/services/userManagementService";
import { UserRole, UserStatus, CourseType } from "@/types/prisma";

const VALID_STATUSES = new Set<string>(Object.values(UserStatus));
const VALID_COURSE_TYPES = new Set<string>(Object.values(CourseType));

function getService(): UserManagementService {
  return new UserManagementService(new UserRepository());
}

export async function GET(request: Request): Promise<NextResponse> {
  const session = await getServerSession(authOptions);

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (session.user.role !== UserRole.ADMIN) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const statusParam = searchParams.get("status");

  if (statusParam !== null && !VALID_STATUSES.has(statusParam)) {
    return NextResponse.json(
      { error: "無効なステータス値です" },
      { status: 400 }
    );
  }

  const filter = statusParam ? { status: statusParam as UserStatus } : undefined;
  const users = await getService().listUsers(filter);

  return NextResponse.json({ users }, { status: 200 });
}

export async function POST(request: Request): Promise<NextResponse> {
  const session = await getServerSession(authOptions);

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (session.user.role !== UserRole.ADMIN) {
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
    return NextResponse.json(
      { error: "必須フィールドが不正です" },
      { status: 400 }
    );
  }

  try {
    const user = await getService().createUser({
      email: body.email,
      name: body.name,
      password: body.password,
      courseType: body.courseType as CourseType,
    });
    return NextResponse.json({ user }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    if (message.includes("すでに使用されています")) {
      return NextResponse.json({ error: message }, { status: 409 });
    }
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
