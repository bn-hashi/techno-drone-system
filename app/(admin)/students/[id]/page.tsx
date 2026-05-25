import Link from "next/link";
import { notFound } from "next/navigation";
import { getUserManagementService } from "@/lib/serviceFactory";
import { UserStatus } from "@/types/prisma";
import { InviteButton } from "./InviteButton";

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

interface StudentDetailPageProps {
  params: { id: string };
}

export default async function StudentDetailPage({ params }: StudentDetailPageProps) {
  const student = await getUserManagementService().getUserById(params.id);

  if (!student) {
    notFound();
  }

  const isPendingActivation = student.status === UserStatus.PENDING_ACTIVATION;

  return (
    <div className="max-w-2xl mx-auto py-8 px-4">
      <h1 className="text-2xl font-semibold text-gray-900 mb-6">受講者詳細</h1>

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <dl className="divide-y divide-gray-100">
          <div className="px-6 py-4 flex gap-4">
            <dt className="w-32 text-sm font-medium text-gray-500 shrink-0">氏名</dt>
            <dd className="text-sm text-gray-900">{student.name}</dd>
          </div>
          <div className="px-6 py-4 flex gap-4">
            <dt className="w-32 text-sm font-medium text-gray-500 shrink-0">メール</dt>
            <dd className="text-sm text-gray-900">{student.email}</dd>
          </div>
          <div className="px-6 py-4 flex gap-4">
            <dt className="w-32 text-sm font-medium text-gray-500 shrink-0">コース</dt>
            <dd className="text-sm text-gray-900">
              {(student.courseType && COURSE_TYPE_LABELS[student.courseType]) ??
                student.courseType ??
                "—"}
            </dd>
          </div>
          <div className="px-6 py-4 flex gap-4">
            <dt className="w-32 text-sm font-medium text-gray-500 shrink-0">ステータス</dt>
            <dd className="text-sm text-gray-900">
              {STATUS_LABELS[student.status] ?? student.status}
            </dd>
          </div>
          <div className="px-6 py-4 flex gap-4">
            <dt className="w-32 text-sm font-medium text-gray-500 shrink-0">登録日</dt>
            <dd className="text-sm text-gray-900">
              {new Date(student.createdAt).toLocaleDateString("ja-JP")}
            </dd>
          </div>
        </dl>
      </div>

      {isPendingActivation && (
        <div className="mt-6 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <h2 className="text-sm font-medium text-yellow-800 mb-2">本登録を促す</h2>
          <p className="text-sm text-yellow-700 mb-4">
            このユーザーはまだ本登録を完了していません。招待メールを送信してパスワード設定・規約同意を促してください。
          </p>
          <InviteButton studentId={params.id} />
        </div>
      )}

      {student.status === UserStatus.EXAM_PASSED && (
        <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h2 className="text-sm font-medium text-blue-800 mb-2">受講確認・成立判定</h2>
          <p className="text-sm text-blue-700 mb-4">
            この受講者は試験に合格しています。受講時間と視聴ログを確認した上で、受講成立/不成立の判定を行ってください。
          </p>
          <Link
            href={`/admin/students/${params.id}/review`}
            className="inline-block rounded bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700"
          >
            受講確認画面へ
          </Link>
        </div>
      )}
    </div>
  );
}
