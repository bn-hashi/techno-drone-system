import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getUserManagementService } from "@/lib/serviceFactory";
import { UserRole, UserStatus, CourseType } from "@/types/prisma";

const VALID_STATUSES = new Set<string>(Object.values(UserStatus));
const VALID_COURSE_TYPES = new Set<string>(Object.values(CourseType));

// 業務エラーとして想定されるメッセージのパターン
// これに該当しない例外はクライアントに内部情報を露出させない
const BUSINESS_ERROR_PATTERNS = [
  "すでに使用されています",
  "メールアドレス",
  "氏名",
  "パスワード",
] as const;

function isBusinessError(message: string): boolean {
  return BUSINESS_ERROR_PATTERNS.some((pattern) => message.includes(pattern));
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
  const users = await getUserManagementService().listUsers(filter);

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
    const user = await getUserManagementService().createUser({
      email: body.email,
      name: body.name,
      password: body.password,
      courseType: body.courseType as CourseType,
    });
    return NextResponse.json({ user }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "";
    if (message.includes("すでに使用されています")) {
      return NextResponse.json({ error: message }, { status: 409 });
    }
    if (isBusinessError(message)) {
      return NextResponse.json({ error: message }, { status: 400 });
    }
    // 予期しない内部エラーは詳細を露出しない
    return NextResponse.json(
      { error: "内部エラーが発生しました" },
      { status: 500 }
    );
  }
}
