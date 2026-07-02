import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getUserManagementService } from "@/lib/serviceFactory";
import { StatusChangeButton } from "@/components/admin/StatusChangeButton";
import { USER_STATUS_LABELS } from "@/lib/constants/userStatusLabels";
import { UserRole, UserStatus } from "@/types/prisma";

export const dynamic = "force-dynamic";
export const metadata = { title: "受講者管理" };

// デザインのセマンティック色: 受講中=accent / 修了系=success / 待ち=warning / 初期=neutral
const STATUS_PILL_STYLE: Record<UserStatus, string> = {
  PENDING_REGISTRATION: "bg-neutral/10 text-neutral",
  PENDING_ACTIVATION: "bg-warning/10 text-warning",
  ACTIVE: "bg-accent/10 text-accent",
  EXAM_PASSED: "bg-success/10 text-success",
  COMPLETED: "bg-success/10 text-success",
  CERTIFIED: "bg-success/10 text-success",
  DIPS_LINKED: "bg-success/10 text-success",
};

export default async function AdminUsersPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.role !== UserRole.ADMIN) {
    redirect("/login");
  }

  const users = await getUserManagementService().listUsers();

  return (
    <div>
      <div className="mb-[18px] flex items-center justify-between">
        <span className="text-[13px] text-[#475467]">
          該当 <b className="text-heading">{users.length}</b> 名
        </span>
        <a
          href="/admin/users/new"
          className="rounded-[9px] bg-accent px-4 py-2 text-[13px] font-medium text-white hover:bg-primary"
        >
          ＋ 新規登録
        </a>
      </div>

      <div className="overflow-hidden rounded-card border border-line bg-white shadow-card">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-[12.5px]">
            <thead>
              <tr className="bg-[#f8fafc] text-left text-[11.5px] font-bold text-muted">
                <th className="border-b border-line px-3 py-[11px]">氏名</th>
                <th className="border-b border-line px-3 py-[11px]">メール</th>
                <th className="border-b border-line px-3 py-[11px]">ステータス</th>
                <th className="border-b border-line px-3 py-[11px]">操作</th>
                <th className="border-b border-line px-3 py-[11px]">入学申請</th>
                <th className="border-b border-line px-3 py-[11px]">詳細</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id} className="border-b border-line-soft hover:bg-[#fafbfd]">
                  <td className="whitespace-nowrap px-3 py-[11px] font-medium text-heading">
                    {user.name}
                  </td>
                  <td className="whitespace-nowrap px-3 py-[11px] text-[#475467]">{user.email}</td>
                  <td className="whitespace-nowrap px-3 py-[11px]">
                    <span
                      className={`inline-block rounded-full px-[11px] py-[3px] text-[11px] font-semibold ${STATUS_PILL_STYLE[user.status as UserStatus]}`}
                    >
                      {USER_STATUS_LABELS[user.status as UserStatus]}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-3 py-[11px]">
                    <StatusChangeButton
                      userId={user.id}
                      currentStatus={user.status as UserStatus}
                    />
                  </td>
                  <td className="whitespace-nowrap px-3 py-[11px]">
                    <a
                      href={`/admin/enrollment/new?userId=${user.id}`}
                      className="rounded-[7px] bg-success px-3 py-1 text-xs font-medium text-white hover:opacity-90"
                    >
                      入学申請
                    </a>
                  </td>
                  <td className="whitespace-nowrap px-3 py-[11px]">
                    <Link
                      href={`/admin/students/${user.id}`}
                      className="rounded-[7px] border border-line bg-white px-3 py-1 text-xs text-[#475467] hover:bg-surface"
                    >
                      詳細
                    </Link>
                  </td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-3 py-6 text-center text-faint">
                    受講者が登録されていません
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
