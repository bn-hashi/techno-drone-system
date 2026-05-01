import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { fetchAdminUsers } from "@/lib/api/adminUsers";
import { StatusChangeButton } from "@/components/admin/StatusChangeButton";
import { UserRole, UserStatus } from "@/types/prisma";

export const dynamic = "force-dynamic";
export const metadata = { title: "受講者管理" };

export default async function AdminUsersPage() {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== UserRole.ADMIN) {
    redirect("/login");
  }

  const headersList = headers();
  const host = headersList.get("host") ?? "localhost:3000";
  const protocol = headersList.get("x-forwarded-proto") ?? "http";
  const baseUrl = `${protocol}://${host}`;
  const cookie = headersList.get("cookie") ?? "";

  const users = await fetchAdminUsers(baseUrl, cookie);

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
            </tr>
          ))}
          {users.length === 0 && (
            <tr>
              <td
                colSpan={4}
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
