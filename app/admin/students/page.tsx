import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { authOptions } from "@/lib/auth";
import { getUserManagementService } from "@/lib/serviceFactory";
import { UserRole } from "@/types/prisma";
import { USER_STATUS_LABELS } from "@/lib/constants/userStatusLabels";

export const dynamic = "force-dynamic";

export default async function AdminStudentsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.role !== UserRole.ADMIN) {
    redirect("/login");
  }

  const students = await getUserManagementService().listUsers({ role: UserRole.STUDENT });

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-semibold text-gray-900">受講者一覧</h1>
      {students.length === 0 ? (
        <p className="text-sm text-gray-500">受講者が登録されていません。</p>
      ) : (
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
          <table className="w-full text-sm">
            <thead className="border-b border-gray-200 bg-gray-50 text-left text-xs text-gray-500">
              <tr>
                <th className="px-4 py-3">氏名</th>
                <th className="px-4 py-3">メール</th>
                <th className="px-4 py-3">ステータス</th>
                <th className="px-4 py-3">登録日</th>
                <th className="px-4 py-3">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {students.map((student) => (
                <tr key={student.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-900">{student.name}</td>
                  <td className="px-4 py-3 text-gray-600">{student.email}</td>
                  <td className="px-4 py-3 text-gray-700">
                    {USER_STATUS_LABELS[student.status]}
                  </td>
                  <td className="px-4 py-3 text-gray-500">
                    {new Date(student.createdAt).toLocaleDateString("ja-JP")}
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/students/${student.id}`}
                      className="text-blue-600 hover:underline"
                    >
                      詳細
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
