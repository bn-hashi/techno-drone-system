import Link from "next/link";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { getExamService, getUserManagementService } from "@/lib/serviceFactory";
import { UserRole, UserStatus, ExamStatus } from "@/types/prisma";
import { StartExamButton } from "@/components/student/exams/StartExamButton";

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<ExamStatus, string> = {
  IN_PROGRESS: "進行中",
  PASSED: "合格",
  FAILED: "不合格",
};

function formatDate(date: Date | string | null): string {
  if (date === null) return "-";
  return new Date(date).toLocaleString("ja-JP", {
    hour12: false,
    timeZone: "Asia/Tokyo",
  });
}

export default async function StudentExamsPage() {
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
        <h1 className="mb-4 text-2xl font-semibold">修了確認試験</h1>
        <p className="text-sm text-red-600">コースが未割当です。管理者にお問い合わせください。</p>
      </main>
    );
  }

  const examService = getExamService();
  const eligibility = await examService.checkEligibility(session.user.id, user.courseType);
  const history = await examService.listResultsByUser(session.user.id);

  const shortages = eligibility.progress.filter((p) => !p.isFulfilled);

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="mb-4 text-2xl font-semibold text-gray-900">修了確認試験</h1>

      <section className="mb-6 rounded-lg border border-gray-200 bg-white p-4">
        <h2 className="mb-3 text-sm font-medium text-gray-700">受験条件</h2>
        {eligibility.eligible ? (
          <p data-testid="eligibility-ok" className="text-sm text-green-700">
            全科目の受講時間を満たしています。試験を開始できます。
          </p>
        ) : (
          <div data-testid="eligibility-ng">
            <p className="mb-2 text-sm text-red-700">
              受験には全科目の受講時間を満たす必要があります。
            </p>
            <ul className="list-disc pl-5 text-xs text-gray-600">
              {shortages.map((p) => (
                <li key={p.subjectId}>
                  {p.subjectName}: {p.totalWatchedMinutes} / {p.requiredMinutes} 分
                </li>
              ))}
            </ul>
          </div>
        )}
        <div className="mt-4">
          <StartExamButton disabled={!eligibility.eligible} />
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-medium text-gray-700">過去の試験履歴</h2>
        {history.length === 0 ? (
          <p className="text-sm text-gray-500">まだ受験履歴がありません。</p>
        ) : (
          <ul data-testid="exam-history" className="space-y-2">
            {history.map((exam) => (
              <li
                key={exam.id}
                className="flex items-center justify-between rounded-lg border border-gray-200 bg-white p-3 text-sm"
              >
                <div>
                  <p className="text-gray-900">{formatDate(exam.startedAt)} 開始</p>
                  <p className="text-xs text-gray-500">
                    {STATUS_LABEL[exam.status]}
                    {exam.score !== null && ` / ${exam.score}点`}
                  </p>
                </div>
                {exam.status !== ExamStatus.IN_PROGRESS && (
                  <Link
                    href={`/exams/${exam.id}/result`}
                    className="rounded bg-blue-600 px-3 py-1 text-xs text-white hover:bg-blue-700"
                  >
                    結果を見る
                  </Link>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
