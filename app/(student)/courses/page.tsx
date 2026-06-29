import { notFound } from "next/navigation";
import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getCourseService, getUserManagementService } from "@/lib/serviceFactory";
import { UserRole, UserStatus } from "@/types/prisma";
import type { Course } from "@prisma/client";

export default async function CoursesPage() {
  const session = await getServerSession(authOptions);

  if (
    !session?.user ||
    session.user.role !== UserRole.STUDENT ||
    session.user.status !== UserStatus.ACTIVE
  ) {
    notFound();
  }

  const userId = session.user.id;
  const [dbUser, allCourses] = await Promise.all([
    getUserManagementService().getUserById(userId),
    getCourseService().listCourses(),
  ]);

  const accessibleCourses: Course[] =
    dbUser?.courseType != null
      ? allCourses.filter((course) => course.type === dbUser.courseType)
      : [];

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold">コース一覧</h1>
      {accessibleCourses.length === 0 ? (
        <p className="text-gray-500">受講可能なコースがありません。</p>
      ) : (
        <ul className="space-y-4">
          {accessibleCourses.map((course) => (
            <li key={course.id}>
              <Link
                href={`/courses/${course.id}`}
                className="block rounded-lg border p-4 hover:bg-gray-50"
              >
                {course.name}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
