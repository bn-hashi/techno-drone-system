import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getUserManagementService } from "@/lib/serviceFactory";
import { StatusChangeButton } from "@/components/admin/StatusChangeButton";
import { UserRole, UserStatus } from "@/types/prisma";

export const dynamic = "force-dynamic";
export const metadata = { title: "受講者管理" };

export default async function AdminUsersPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.role !== UserRole.ADMIN) {
    redirect("/login");
  }

  const users = await getUserManagementService().listUsers();

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">受講者管理</h1>
        <a
          href="/admin/users/new"
          className="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
        >
          新規登録
        </a>
      </div>

      <table className="w-full border-collapse border border-gray-300">
        <thead>
          <tr className="bg-gray-100">
            <th className="border border-gray-300 px-4 py-2 text-left">氏名</th>
            <th className="border border-gray-300 px-4 py-2 text-left">メール</th>
            <th className="border border-gray-300 px-4 py-2 text-left">ステータス</th>
            <th className="border border-gray-300 px-4 py-2 text-left">操作</th>
            <th className="border border-gray-300 px-4 py-2 text-left">入学申請</th>
            <th className="border border-gray-300 px-4 py-2 text-left">詳細</th>
          </tr>
        </thead>
        <tbody>
          {users.map((user) => (
            <tr key={user.id}>
              <td className="border border-gray-300 px-4 py-2">{user.name}</td>
              <td className="border border-gray-300 px-4 py-2">{user.email}</td>
              <td className="border border-gray-300 px-4 py-2">{user.status}</td>
              <td className="border border-gray-300 px-4 py-2">
                <StatusChangeButton userId={user.id} currentStatus={user.status as UserStatus} />
              </td>
              <td className="border border-gray-300 px-4 py-2">
                <a
                  href={`/admin/enrollment/new?userId=${user.id}`}
                  className="rounded bg-green-600 px-3 py-1 text-sm text-white hover:bg-green-700"
                >
                  入学申請
                </a>
              </td>
              <td className="border border-gray-300 px-4 py-2">
                <Link
                  href={`/students/${user.id}`}
                  className="rounded bg-gray-600 px-3 py-1 text-sm text-white hover:bg-gray-700"
                >
                  詳細
                </Link>
              </td>
            </tr>
          ))}
          {users.length === 0 && (
            <tr>
              <td
                colSpan={6}
                className="border border-gray-300 px-4 py-2 text-center text-gray-500"
              >
                受講者が登録されていません
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
