import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { authOptions } from "@/lib/auth";
import { getProgressService, getUserManagementService } from "@/lib/serviceFactory";
import { UserRole, UserStatus } from "@/types/prisma";

export const dynamic = "force-dynamic";

const COURSE_TYPE_LABELS: Record<string, string> = {
  BEGINNER: "初学者コース",
  EXPERIENCED: "経験者コース",
};

export default async function StudentDashboardPage() {
  const session = await getServerSession(authOptions);

  if (
    !session?.user ||
    session.user.role !== UserRole.STUDENT ||
    session.user.status !== UserStatus.ACTIVE
  ) {
    redirect("/login");
  }

  const user = await getUserManagementService().getUserById(session.user.id);
  if (!user || !user.courseType) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-8">
        <h1 className="mb-4 text-2xl font-semibold">受講者ダッシュボード</h1>
        <p className="text-sm text-red-600">コースが未割当です。管理者にお問い合わせください。</p>
      </main>
    );
  }

  const progress = await getProgressService().getProgressByUser(session.user.id, user.courseType);
  const fulfilledCount = progress.filter((p) => p.isFulfilled).length;

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="mb-2 text-2xl font-semibold text-gray-900">受講者ダッシュボード</h1>
      <p className="mb-6 text-sm text-gray-600">
        {COURSE_TYPE_LABELS[user.courseType] ?? user.courseType} / {user.name} さん
      </p>

      <section className="mb-6 rounded-lg border border-gray-200 bg-white p-4">
        <h2 className="mb-2 text-sm font-medium text-gray-700">受講進捗サマリー</h2>
        <p className="text-2xl font-semibold text-gray-900">
          {fulfilledCount} / {progress.length} 科目充足
        </p>
      </section>

      <section className="mb-6">
        <h2 className="mb-3 text-sm font-medium text-gray-700">科目別進捗</h2>
        <ul className="space-y-3">
          {progress.map((p) => {
            const ratio = Math.min(p.totalWatchedMinutes / p.requiredMinutes, 1);
            const percent = Math.floor(ratio * 100);
            return (
              <li
                key={p.subjectId}
                className="rounded-lg border border-gray-200 bg-white p-4"
              >
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-900">{p.subjectName}</span>
                  <span className="text-xs text-gray-500">
                    {p.totalWatchedMinutes} / {p.requiredMinutes} 分
                    {p.isFulfilled && (
                      <span className="ml-2 inline-flex rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800">
                        充足
                      </span>
                    )}
                  </span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200">
                  <div
                    className={`h-full ${p.isFulfilled ? "bg-green-500" : "bg-blue-500"}`}
                    style={{ width: `${percent}%` }}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      <section>
        <Link
          href="/courses"
          className="inline-block rounded bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700"
        >
          受講ページへ
        </Link>
      </section>
    </main>
  );
}
