import Link from "next/link";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { getFlightPlanService } from "@/lib/serviceFactory";
import { UserRole } from "@/types/prisma";
import { hasFlightAccess } from "@/lib/auth/flightPermissions";
import type { FlightPlanStatus } from "@prisma/client";

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<FlightPlanStatus, string> = {
  DRAFT: "下書き",
  APPROVED: "承認済み",
  REJECTED: "却下",
  COMPLETED: "完了",
};

const STATUS_STYLE: Record<FlightPlanStatus, string> = {
  DRAFT: "bg-gray-100 text-gray-600",
  APPROVED: "bg-blue-100 text-blue-700",
  REJECTED: "bg-red-100 text-red-700",
  COMPLETED: "bg-green-100 text-green-700",
};

export default async function FlightPlanListPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user || !hasFlightAccess(session.user.role as UserRole)) {
    redirect("/login");
  }

  const role = session.user.role as UserRole;
  const plans = await getFlightPlanService().list({
    userId: session.user.id,
    isAdmin: role === UserRole.ADMIN,
  });

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-xl font-semibold text-gray-900">飛行計画</h1>
        <Link
          href="/flight/plans/new"
          className="px-4 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
        >
          + 飛行計画を作成
        </Link>
      </div>

      {plans.length === 0 ? (
        <p className="text-gray-500 text-sm">飛行計画がありません。</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b border-gray-200 text-left text-gray-600">
                <th className="pb-2 pr-4 font-medium">タイトル</th>
                <th className="pb-2 pr-4 font-medium">飛行場所</th>
                <th className="pb-2 pr-4 font-medium">飛行予定日時</th>
                <th className="pb-2 pr-4 font-medium">時間</th>
                <th className="pb-2 font-medium">ステータス</th>
              </tr>
            </thead>
            <tbody>
              {plans.map((plan) => (
                <tr key={plan.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="py-3 pr-4">
                    <Link
                      href={`/flight/plans/${plan.id}`}
                      className="text-blue-600 hover:underline"
                    >
                      {plan.title}
                    </Link>
                  </td>
                  <td className="py-3 pr-4 text-gray-700">{plan.location}</td>
                  <td className="py-3 pr-4 text-gray-700">
                    {new Date(plan.plannedAt).toLocaleString("ja-JP", {
                      timeZone: "Asia/Tokyo",
                      year: "numeric",
                      month: "2-digit",
                      day: "2-digit",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </td>
                  <td className="py-3 pr-4 text-gray-700">{plan.durationMin} 分</td>
                  <td className="py-3">
                    <span
                      className={`px-2 py-0.5 rounded text-xs font-medium ${STATUS_STYLE[plan.status as FlightPlanStatus]}`}
                    >
                      {STATUS_LABEL[plan.status as FlightPlanStatus]}
                    </span>
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
