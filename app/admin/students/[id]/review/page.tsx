import { getServerSession } from "next-auth";
import { redirect, notFound } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { getJudgmentService } from "@/lib/serviceFactory";
import { JudgmentForm } from "@/components/admin/judgment/JudgmentForm";
import { UserRole, JudgmentResult, FraudFlagType } from "@/types/prisma";
import { BusinessError } from "@/services/errors";

export const dynamic = "force-dynamic";

interface ReviewPageProps {
  params: Promise<{ id: string }>;
}

const STATUS_LABELS: Record<string, string> = {
  PENDING_REGISTRATION: "入学申請受付前",
  PENDING_ACTIVATION: "本登録待ち",
  ACTIVE: "受講中",
  EXAM_PASSED: "試験合格",
  COMPLETED: "修了",
  CERTIFIED: "資格取得",
  DIPS_LINKED: "DIPS連携済",
};

const COURSE_TYPE_LABELS: Record<string, string> = {
  BEGINNER: "初学者コース",
  EXPERIENCED: "経験者コース",
};

const FRAUD_TYPE_LABELS: Record<string, string> = {
  [FraudFlagType.TAB_LEAVE]: "タブ離脱",
  [FraudFlagType.CONCURRENT_LOGIN]: "同時ログイン",
  [FraudFlagType.SPEED_VIOLATION]: "再生速度違反",
};

const JUDGMENT_LABELS: Record<JudgmentResult, string> = {
  [JudgmentResult.ACCEPTED]: "成立",
  [JudgmentResult.REJECTED]: "不成立",
};

function formatDate(date: Date | string | null): string {
  if (date === null) return "-";
  return new Date(date).toLocaleString("ja-JP", {
    hour12: false,
    timeZone: "Asia/Tokyo",
  });
}

export default async function ReviewPage({ params }: ReviewPageProps) {
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.role !== UserRole.ADMIN) {
    redirect("/login");
  }

  const { id } = await params;
  let data;
  try {
    data = await getJudgmentService().getReviewData(id);
  } catch (err) {
    if (err instanceof BusinessError) {
      notFound();
    }
    throw err;
  }

  const { user, progress, fraudFlags, judgmentHistory, canJudge } = data;

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="mb-1 text-2xl font-semibold text-gray-900">受講確認・成立判定</h1>
      <p className="mb-6 text-sm text-gray-500">
        受講者: {user.name} ({user.email})
      </p>

      {/* 基本情報 */}
      <section className="mb-6 rounded-lg border border-gray-200 bg-white p-4">
        <h2 className="mb-3 text-sm font-medium text-gray-700">基本情報</h2>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
          <div>
            <dt className="text-gray-500">現在のステータス</dt>
            <dd className="text-gray-900">{STATUS_LABELS[user.status] ?? user.status}</dd>
          </div>
          <div>
            <dt className="text-gray-500">コース</dt>
            <dd className="text-gray-900">
              {user.courseType ? COURSE_TYPE_LABELS[user.courseType] : "未割当"}
            </dd>
          </div>
        </dl>
      </section>

      {/* 科目別受講時間 */}
      <section className="mb-6 rounded-lg border border-gray-200 bg-white p-4">
        <h2 className="mb-3 text-sm font-medium text-gray-700">科目別受講時間充足状況</h2>
        {progress.length === 0 ? (
          <p className="text-sm text-gray-500">受講進捗データがありません。</p>
        ) : (
          <table data-testid="progress-table" className="w-full text-sm">
            <thead className="border-b border-gray-200 text-left text-xs text-gray-500">
              <tr>
                <th className="px-2 py-2">科目</th>
                <th className="px-2 py-2">受講時間</th>
                <th className="px-2 py-2">必要時間</th>
                <th className="px-2 py-2">充足</th>
              </tr>
            </thead>
            <tbody>
              {progress.map((p) => (
                <tr key={p.subjectId} className="border-b border-gray-100">
                  <td className="px-2 py-2 text-gray-900">{p.subjectName}</td>
                  <td className="px-2 py-2 text-gray-700">{p.totalWatchedMinutes} 分</td>
                  <td className="px-2 py-2 text-gray-500">{p.requiredMinutes} 分</td>
                  <td className="px-2 py-2">
                    <span
                      className={`rounded px-2 py-0.5 text-xs font-medium ${
                        p.isFulfilled
                          ? "bg-green-100 text-green-800"
                          : "bg-amber-100 text-amber-800"
                      }`}
                    >
                      {p.isFulfilled ? "OK" : "不足"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {/* 不正フラグ */}
      <section className="mb-6 rounded-lg border border-gray-200 bg-white p-4">
        <h2 className="mb-3 text-sm font-medium text-gray-700">不正フラグ</h2>
        {fraudFlags.length === 0 ? (
          <p className="text-sm text-gray-500">検知された不正フラグはありません。</p>
        ) : (
          <ul data-testid="fraud-flag-list" className="space-y-2 text-sm">
            {fraudFlags.map((f) => (
              <li
                key={f.id}
                className="flex items-start justify-between rounded border border-gray-200 p-2"
              >
                <div>
                  <p className="font-medium text-gray-900">{FRAUD_TYPE_LABELS[f.type] ?? f.type}</p>
                  {f.description !== null && (
                    <p className="text-xs text-gray-500">{f.description}</p>
                  )}
                </div>
                <div className="text-right text-xs text-gray-500">
                  <p>検知: {formatDate(f.detectedAt)}</p>
                  {f.resolvedAt !== null && <p>解消: {formatDate(f.resolvedAt)}</p>}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* 判定履歴 */}
      {judgmentHistory.length > 0 && (
        <section className="mb-6 rounded-lg border border-gray-200 bg-white p-4">
          <h2 className="mb-3 text-sm font-medium text-gray-700">過去の判定履歴</h2>
          <ul data-testid="judgment-history" className="space-y-2 text-sm">
            {judgmentHistory.map((j) => (
              <li key={j.id} className="rounded border border-gray-200 p-2">
                <div className="flex items-center justify-between">
                  <span
                    className={`rounded px-2 py-0.5 text-xs font-medium ${
                      j.result === JudgmentResult.ACCEPTED
                        ? "bg-green-100 text-green-800"
                        : "bg-red-100 text-red-800"
                    }`}
                  >
                    {JUDGMENT_LABELS[j.result as JudgmentResult]}
                  </span>
                  <span className="text-xs text-gray-500">
                    {formatDate(j.judgedAt)} / 判定者: {j.judgedBy}
                  </span>
                </div>
                {j.comment !== null && <p className="mt-1 text-xs text-gray-700">{j.comment}</p>}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* 判定操作 */}
      <section className="mb-6">
        <h2 className="mb-3 text-sm font-medium text-gray-700">判定操作</h2>
        {canJudge ? (
          <JudgmentForm userId={user.id} />
        ) : (
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm text-gray-600">
            判定対象外のステータスです。受講成立判定は試験合格 (EXAM_PASSED)
            状態の受講者のみ実行できます。
          </div>
        )}
      </section>
    </div>
  );
}
