import Link from "next/link";
import { getFlightLogService } from "@/lib/serviceFactory";
import { requireAdminSession } from "@/lib/serverAuth";
import { formatFlightDateTime } from "@/lib/utils/formatFlightDateTime";
import { parsePageParam } from "@/lib/utils/parsePageParam";

export const dynamic = "force-dynamic";

interface AdminFlightLogsPageProps {
  searchParams: { page?: string };
}

export default async function AdminFlightLogsPage({ searchParams }: AdminFlightLogsPageProps) {
  await requireAdminSession();

  const page = parsePageParam(searchParams.page);
  // ADMIN は全操縦者の日誌を閲覧できる (userId はページネーション用途では未使用)
  const { logs, total, limit } = await getFlightLogService().list(
    { userId: "", isAdmin: true },
    { page }
  );
  const hasNextPage = page * limit < total;
  const hasPreviousPage = page > 1;

  return (
    <div className="p-6">
      <h1 className="text-xl font-semibold text-gray-900 mb-6">飛行日誌一覧（全操縦者）</h1>

      {logs.length === 0 ? (
        <p className="text-gray-500 text-sm">飛行日誌がありません。</p>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b border-gray-200 text-left text-gray-600">
                  <th className="pb-2 pr-4 font-medium">飛行開始日時</th>
                  <th className="pb-2 pr-4 font-medium">飛行場所</th>
                  <th className="pb-2 font-medium">飛行時間</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-3 pr-4">
                      <Link
                        href={`/flight/logs/${log.id}`}
                        className="text-blue-600 hover:underline"
                      >
                        {formatFlightDateTime(new Date(log.startedAt))}
                      </Link>
                    </td>
                    <td className="py-3 pr-4 text-gray-700">{log.location}</td>
                    <td className="py-3 text-gray-700">{log.durationMin} 分</td>
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
                  href={`/admin/flight-logs?page=${page - 1}`}
                  className="px-3 py-1.5 border border-gray-300 rounded hover:bg-gray-50"
                >
                  前へ
                </Link>
              ) : (
                <span className="px-3 py-1.5 border border-gray-200 rounded text-gray-300">
                  前へ
                </span>
              )}
              {hasNextPage ? (
                <Link
                  href={`/admin/flight-logs?page=${page + 1}`}
                  className="px-3 py-1.5 border border-gray-300 rounded hover:bg-gray-50"
                >
                  次へ
                </Link>
              ) : (
                <span className="px-3 py-1.5 border border-gray-200 rounded text-gray-300">
                  次へ
                </span>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
