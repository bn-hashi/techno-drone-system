import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getCourseService } from "@/lib/serviceFactory";
import { UserRole, CourseType } from "@/types/prisma";
import { BusinessError } from "@/services/errors";

const VALID_COURSE_TYPES = new Set<string>(Object.values(CourseType));

export async function GET(_request: Request): Promise<NextResponse> {
  const session = await getServerSession(authOptions);

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!session.user || session.user.role !== UserRole.ADMIN) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const courses = await getCourseService().listCourses();
    return NextResponse.json({ courses }, { status: 200 });
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

  if (!body || typeof body.name !== "string" || !VALID_COURSE_TYPES.has(body.type)) {
    return NextResponse.json({ error: "必須フィールドが不正です" }, { status: 400 });
  }

  try {
    const course = await getCourseService().createCourse({
      name: body.name,
      type: body.type as CourseType,
    });
    return NextResponse.json({ course }, { status: 201 });
  } catch (err) {
    if (err instanceof BusinessError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    return NextResponse.json({ error: "内部エラーが発生しました" }, { status: 500 });
  }
}
