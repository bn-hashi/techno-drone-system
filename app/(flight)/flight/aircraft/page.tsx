import Link from "next/link";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { getAircraftService } from "@/lib/serviceFactory";
import { UserRole } from "@/types/prisma";
import { hasFlightAccess } from "@/lib/auth/flightPermissions";

export const dynamic = "force-dynamic";

export default async function AircraftListPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user || !hasFlightAccess(session.user.role as UserRole)) {
    redirect("/login");
  }

  const role = session.user.role as UserRole;
  const aircrafts = await getAircraftService().list({
    userId: session.user.id,
    isAdmin: role === UserRole.ADMIN,
  });

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-xl font-semibold text-gray-900">機体管理</h1>
        <Link
          href="/flight/aircraft/new"
          className="px-4 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
        >
          + 機体を登録
        </Link>
      </div>

      {aircrafts.length === 0 ? (
        <p className="text-gray-500 text-sm">登録された機体はありません。</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b border-gray-200 text-left text-gray-600">
                <th className="pb-2 pr-4 font-medium">機体名</th>
                <th className="pb-2 pr-4 font-medium">メーカー</th>
                <th className="pb-2 pr-4 font-medium">シリアル番号</th>
                <th className="pb-2 pr-4 font-medium">重量</th>
                <th className="pb-2 pr-4 font-medium">最大飛行時間</th>
                <th className="pb-2 font-medium">ステータス</th>
              </tr>
            </thead>
            <tbody>
              {aircrafts.map((aircraft) => (
                <tr key={aircraft.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="py-3 pr-4">
                    <Link
                      href={`/flight/aircraft/${aircraft.id}`}
                      className="text-blue-600 hover:underline"
                    >
                      {aircraft.name}
                    </Link>
                  </td>
                  <td className="py-3 pr-4 text-gray-700">{aircraft.manufacturer}</td>
                  <td className="py-3 pr-4 text-gray-700 font-mono">{aircraft.serialNumber}</td>
                  <td className="py-3 pr-4 text-gray-700">{aircraft.weightGrams} g</td>
                  <td className="py-3 pr-4 text-gray-700">{aircraft.maxFlightTimeMin} 分</td>
                  <td className="py-3">
                    <span
                      className={`px-2 py-0.5 rounded text-xs font-medium ${
                        aircraft.isActive
                          ? "bg-green-100 text-green-700"
                          : "bg-gray-100 text-gray-500"
                      }`}
                    >
                      {aircraft.isActive ? "有効" : "無効"}
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
