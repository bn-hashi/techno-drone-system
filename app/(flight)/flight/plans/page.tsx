import Link from "next/link";
import { getFlightPlanService } from "@/lib/serviceFactory";
import { requireFlightSession } from "@/lib/auth/requireFlightSession";
import { FLIGHT_PLAN_STATUS_LABELS, FLIGHT_PLAN_STATUS_STYLE } from "@/lib/constants/flightPlanStatusLabels";
import { formatFlightDateTime } from "@/lib/utils/formatFlightDateTime";
import type { FlightPlanStatus } from "@prisma/client";

export const dynamic = "force-dynamic";

interface FlightPlanListPageProps {
  searchParams: { page?: string };
}

export default async function FlightPlanListPage({ searchParams }: FlightPlanListPageProps) {
  const { userId, isAdmin } = await requireFlightSession();

  const page = Number(searchParams.page ?? "1") || 1;
  const { plans, total, limit } = await getFlightPlanService().list({ userId, isAdmin }, { page });
  const hasNextPage = page * limit < total;
  const hasPreviousPage = page > 1;

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
        <>
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
                      {formatFlightDateTime(new Date(plan.plannedAt))}
                    </td>
                    <td className="py-3 pr-4 text-gray-700">{plan.durationMin} 分</td>
                    <td className="py-3">
                      <span
                        className={`px-2 py-0.5 rounded text-xs font-medium ${FLIGHT_PLAN_STATUS_STYLE[plan.status as FlightPlanStatus]}`}
                      >
                        {FLIGHT_PLAN_STATUS_LABELS[plan.status as FlightPlanStatus]}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between mt-4 text-sm text-gray-600">
            <span>
              全 {total} 件中 {(page - 1) * limit + 1}〜{Math.min(page * limit, total)} 件を表示
            </span>
            <div className="flex gap-2">
              {hasPreviousPage ? (
                <Link
                  href={`/flight/plans?page=${page - 1}`}
                  className="px-3 py-1.5 border border-gray-300 rounded hover:bg-gray-50"
                >
                  前へ
                </Link>
              ) : (
                <span className="px-3 py-1.5 border border-gray-200 rounded text-gray-300">前へ</span>
              )}
              {hasNextPage ? (
                <Link
                  href={`/flight/plans?page=${page + 1}`}
                  className="px-3 py-1.5 border border-gray-300 rounded hover:bg-gray-50"
                >
                  次へ
                </Link>
              ) : (
                <span className="px-3 py-1.5 border border-gray-200 rounded text-gray-300">次へ</span>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
