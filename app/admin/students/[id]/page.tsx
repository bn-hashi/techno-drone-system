import { getServerSession } from "next-auth";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { authOptions } from "@/lib/auth";
import { getUserManagementService } from "@/lib/serviceFactory";
import { UserRole, UserStatus } from "@/types/prisma";
import { USER_STATUS_LABELS } from "@/lib/constants/userStatusLabels";
import { InviteButton } from "./InviteButton";

export const dynamic = "force-dynamic";

const COURSE_TYPE_LABELS: Record<string, string> = {
  BEGINNER: "初学者コース",
  EXPERIENCED: "経験者コース",
};

interface StudentDetailPageProps {
  params: { id: string };
}

export default async function StudentDetailPage({ params }: StudentDetailPageProps) {
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.role !== UserRole.ADMIN) {
    redirect("/login");
  }

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
            <dd className="text-sm text-gray-900">{USER_STATUS_LABELS[student.status]}</dd>
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

      {(student.status === UserStatus.COMPLETED ||
        student.status === UserStatus.CERTIFIED ||
        student.status === UserStatus.DIPS_LINKED) && (
        <div className="mt-6 bg-green-50 border border-green-200 rounded-lg p-4">
          <h2 className="text-sm font-medium text-green-800 mb-2">修了証明書</h2>
          <p className="text-sm text-green-700 mb-4">
            {student.status === UserStatus.COMPLETED
              ? "受講成立により修了証明書を発行できます。"
              : "修了証明書を発行済みです。発行内容の確認・再ダウンロードが可能です。"}
          </p>
          <Link
            href={`/admin/students/${params.id}/certificate`}
            className="inline-block rounded bg-green-600 px-4 py-2 text-sm text-white hover:bg-green-700"
          >
            修了証明書画面へ
          </Link>
        </div>
      )}
    </div>
  );
}
