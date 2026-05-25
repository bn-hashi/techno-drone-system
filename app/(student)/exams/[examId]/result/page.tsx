import Link from "next/link";
import { getServerSession } from "next-auth";
import { notFound, redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { getExamService } from "@/lib/serviceFactory";
import { UserRole } from "@/types/prisma";
import { BusinessError, NotFoundError } from "@/services/errors";

export const dynamic = "force-dynamic";

interface Props {
  params: { examId: string };
}

export default async function ExamResultPage({ params }: Props) {
  const session = await getServerSession(authOptions);

  if (!session?.user || session.user.role !== UserRole.STUDENT) {
    redirect("/login");
  }

  let result: Awaited<ReturnType<ReturnType<typeof getExamService>["getExam"]>>;
  try {
    result = await getExamService().getExam(params.examId, session.user.id);
  } catch (err) {
    if (err instanceof NotFoundError || err instanceof BusinessError) {
      notFound();
    }
    throw err;
  }

  const { exam, answers } = result;
  const correctCount = answers.filter((a) => a.isCorrect).length;

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="mb-4 text-2xl font-semibold text-gray-900">試験結果</h1>

      <section
        data-testid="exam-result-summary"
        className={`mb-6 rounded-lg border p-4 ${
          exam.passed
            ? "border-green-300 bg-green-50"
            : "border-red-300 bg-red-50"
        }`}
      >
        <p className="text-sm text-gray-700">合否</p>
        <p
          data-testid="exam-pass-status"
          className={`text-3xl font-bold ${exam.passed ? "text-green-700" : "text-red-700"}`}
        >
          {exam.passed ? "合格" : "不合格"}
        </p>
        <p className="mt-2 text-sm text-gray-700">
          得点: <span data-testid="exam-score">{exam.score ?? 0}</span> 点 / 100 点
        </p>
        <p className="text-sm text-gray-700">
          正答数: {correctCount} / {exam.totalQuestions} 問
        </p>
      </section>

      <div>
        <Link
          href="/exams"
          className="inline-block rounded bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700"
        >
          試験一覧へ戻る
        </Link>
      </div>
    </main>
  );
}
