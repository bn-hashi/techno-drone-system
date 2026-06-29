import { getExamService } from "@/lib/serviceFactory";
import { ExamStatus } from "@/types/prisma";

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<ExamStatus, string> = {
  IN_PROGRESS: "進行中",
  PASSED: "合格",
  FAILED: "不合格",
};

const STATUS_BADGE: Record<ExamStatus, string> = {
  IN_PROGRESS: "bg-gray-100 text-gray-700",
  PASSED: "bg-green-100 text-green-800",
  FAILED: "bg-red-100 text-red-800",
};

function formatDate(date: Date | string | null): string {
  if (date === null) return "-";
  // 本番のサーバータイムゾーンに依存しないよう Asia/Tokyo を明示
  return new Date(date).toLocaleString("ja-JP", {
    hour12: false,
    timeZone: "Asia/Tokyo",
  });
}

export default async function ExamResultsPage() {
  const examResults = await getExamService().listAllResults();

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="mb-4 text-2xl font-semibold text-gray-900">試験結果一覧</h1>
      {examResults.length === 0 ? (
        <p className="text-sm text-gray-500">試験結果はまだありません。</p>
      ) : (
        <table data-testid="exam-results-table" className="w-full text-sm">
          <thead className="border-b border-gray-200 text-left text-xs text-gray-500">
            <tr>
              <th className="px-3 py-2">受験者</th>
              <th className="px-3 py-2">メール</th>
              <th className="px-3 py-2">開始日時</th>
              <th className="px-3 py-2">終了日時</th>
              <th className="px-3 py-2">得点</th>
              <th className="px-3 py-2">合否</th>
              <th className="px-3 py-2">ステータス</th>
            </tr>
          </thead>
          <tbody>
            {examResults.map((exam) => (
              <tr key={exam.id} className="border-b border-gray-100">
                <td className="px-3 py-2 text-gray-900">{exam.user.name}</td>
                <td className="px-3 py-2 text-gray-600">{exam.user.email}</td>
                <td className="px-3 py-2 text-gray-600">{formatDate(exam.startedAt)}</td>
                <td className="px-3 py-2 text-gray-600">{formatDate(exam.endedAt)}</td>
                <td className="px-3 py-2 text-gray-900">{exam.score ?? "-"}</td>
                <td className="px-3 py-2">
                  {exam.passed === null ? "-" : exam.passed ? "合格" : "不合格"}
                </td>
                <td className="px-3 py-2">
                  <span
                    className={`rounded px-2 py-0.5 text-xs font-medium ${STATUS_BADGE[exam.status]}`}
                  >
                    {STATUS_LABEL[exam.status]}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
}
