import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getAircraftService } from "@/lib/serviceFactory";
import { AircraftNotFoundError } from "@/services/errors";
import { UserRole } from "@/types/prisma";
import { hasFlightAccess } from "@/lib/auth/flightPermissions";
import { DeactivateButton } from "./DeactivateButton";

interface AircraftDetailPageProps {
  params: { id: string };
}

export const dynamic = "force-dynamic";

export default async function AircraftDetailPage({ params }: AircraftDetailPageProps) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !hasFlightAccess(session.user.role as UserRole)) {
    redirect("/login");
  }

  const context = {
    userId: session.user.id,
    isAdmin: (session.user.role as UserRole) === UserRole.ADMIN,
  };

  let aircraft;
  try {
    aircraft = await getAircraftService().findById(params.id, context);
  } catch (err) {
    if (err instanceof AircraftNotFoundError) {
      notFound();
    }
    throw err;
  }

  return (
    <div className="p-6 max-w-2xl">
      <div className="flex justify-between items-start mb-6">
        <div>
          <Link
            href="/flight/aircraft"
            className="text-sm text-blue-600 hover:underline mb-1 inline-block"
          >
            ← 機体一覧
          </Link>
          <h1 className="text-xl font-semibold text-gray-900">{aircraft.name}</h1>
        </div>
        <div className="flex gap-2">
          {aircraft.isActive && (
            <Link
              href={`/flight/aircraft/${params.id}/edit`}
              className="px-3 py-1.5 border border-gray-300 text-sm rounded hover:bg-gray-50"
            >
              編集
            </Link>
          )}
          {aircraft.isActive && <DeactivateButton aircraftId={params.id} />}
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <dl className="divide-y divide-gray-100">
          <div className="px-6 py-4 flex gap-4">
            <dt className="w-40 text-sm font-medium text-gray-500 shrink-0">機体名</dt>
            <dd className="text-sm text-gray-900">{aircraft.name}</dd>
          </div>
          <div className="px-6 py-4 flex gap-4">
            <dt className="w-40 text-sm font-medium text-gray-500 shrink-0">製造メーカー</dt>
            <dd className="text-sm text-gray-900">{aircraft.manufacturer}</dd>
          </div>
          <div className="px-6 py-4 flex gap-4">
            <dt className="w-40 text-sm font-medium text-gray-500 shrink-0">型式番号</dt>
            <dd className="text-sm text-gray-900 font-mono">{aircraft.modelNumber}</dd>
          </div>
          <div className="px-6 py-4 flex gap-4">
            <dt className="w-40 text-sm font-medium text-gray-500 shrink-0">シリアル番号</dt>
            <dd className="text-sm text-gray-900 font-mono">{aircraft.serialNumber}</dd>
          </div>
          <div className="px-6 py-4 flex gap-4">
            <dt className="w-40 text-sm font-medium text-gray-500 shrink-0">機体重量</dt>
            <dd className="text-sm text-gray-900">{aircraft.weightGrams.toLocaleString()} g</dd>
          </div>
          <div className="px-6 py-4 flex gap-4">
            <dt className="w-40 text-sm font-medium text-gray-500 shrink-0">最大飛行時間</dt>
            <dd className="text-sm text-gray-900">{aircraft.maxFlightTimeMin} 分</dd>
          </div>
          <div className="px-6 py-4 flex gap-4">
            <dt className="w-40 text-sm font-medium text-gray-500 shrink-0">登録記号</dt>
            <dd className="text-sm text-gray-900">{aircraft.registrationNumber ?? "—"}</dd>
          </div>
          <div className="px-6 py-4 flex gap-4">
            <dt className="w-40 text-sm font-medium text-gray-500 shrink-0">ステータス</dt>
            <dd>
              <span
                className={`px-2 py-0.5 rounded text-xs font-medium ${
                  aircraft.isActive ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
                }`}
              >
                {aircraft.isActive ? "有効" : "無効（廃止）"}
              </span>
            </dd>
          </div>
          <div className="px-6 py-4 flex gap-4">
            <dt className="w-40 text-sm font-medium text-gray-500 shrink-0">登録日</dt>
            <dd className="text-sm text-gray-900">
              {new Date(aircraft.createdAt).toLocaleDateString("ja-JP", { timeZone: "Asia/Tokyo" })}
            </dd>
          </div>
        </dl>
      </div>
    </div>
  );
}
