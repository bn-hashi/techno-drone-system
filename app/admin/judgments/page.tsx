import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { authOptions } from "@/lib/auth";
import { getUserManagementService } from "@/lib/serviceFactory";
import { UserRole, UserStatus } from "@/types/prisma";

export const dynamic = "force-dynamic";

export default async function AdminJudgmentsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.role !== UserRole.ADMIN) {
    redirect("/login");
  }

  const pendingStudents = await getUserManagementService().listUsers({
    role: UserRole.STUDENT,
    status: UserStatus.EXAM_PASSED,
  });

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="mb-2 text-2xl font-semibold text-gray-900">成績・修了判定</h1>
      <p className="mb-6 text-sm text-gray-500">試験合格済みで判定待ちの受講者を表示しています。</p>
      {pendingStudents.length === 0 ? (
        <p className="text-sm text-gray-500">現在、判定待ちの受講者はいません。</p>
      ) : (
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
          <table className="w-full text-sm">
            <thead className="border-b border-gray-200 bg-gray-50 text-left text-xs text-gray-500">
              <tr>
                <th className="px-4 py-3">氏名</th>
                <th className="px-4 py-3">メール</th>
                <th className="px-4 py-3">登録日</th>
                <th className="px-4 py-3">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {pendingStudents.map((student) => (
                <tr key={student.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-900">{student.name}</td>
                  <td className="px-4 py-3 text-gray-600">{student.email}</td>
                  <td className="px-4 py-3 text-gray-500">
                    {new Date(student.createdAt).toLocaleDateString("ja-JP")}
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/students/${student.id}/review`}
                      className="inline-block rounded bg-blue-600 px-3 py-1 text-xs text-white hover:bg-blue-700"
                    >
                      判定画面へ
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
