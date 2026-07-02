import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getFlightPlanService } from "@/lib/serviceFactory";
import { AircraftRepository } from "@/repositories/aircraftRepository";
import { FlightPlanNotFoundError } from "@/services/errors";
import { UserRole } from "@/types/prisma";
import { hasFlightAccess } from "@/lib/auth/flightPermissions";
import { calcFallDistance } from "@/lib/utils/fallDistance";
import { getRiskStub } from "@/lib/stubs/weatherStub";
import { StatusUpdateButton } from "@/components/flight/plans/StatusUpdateButton";
import type { FlightPlanStatus } from "@prisma/client";

const STUB_ALTITUDE_METERS = 50;

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

interface FlightPlanDetailPageProps {
  params: { id: string };
}

export const dynamic = "force-dynamic";

export default async function FlightPlanDetailPage({ params }: FlightPlanDetailPageProps) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !hasFlightAccess(session.user.role as UserRole)) {
    redirect("/login");
  }

  const role = session.user.role as UserRole;
  const isAdmin = role === UserRole.ADMIN;
  const context = { userId: session.user.id, isAdmin };

  let plan;
  try {
    plan = await getFlightPlanService().findById(params.id, context);
  } catch (err) {
    if (err instanceof FlightPlanNotFoundError) {
      notFound();
    }
    throw err;
  }

  const aircraftRepo = new AircraftRepository();
  const aircraft = await aircraftRepo.findById(plan.aircraftId);

  let risk = null;
  if (aircraft) {
    const fallDistanceM = calcFallDistance(aircraft.weightGrams, STUB_ALTITUDE_METERS);
    risk = getRiskStub(fallDistanceM);
  }

  const status = plan.status as FlightPlanStatus;
  const isOwnPlan = plan.userId === session.user.id;

  return (
    <div className="p-6 max-w-2xl">
      <div className="flex justify-between items-start mb-6">
        <div>
          <Link
            href="/flight/plans"
            className="text-sm text-blue-600 hover:underline mb-1 inline-block"
          >
            ← 飛行計画一覧
          </Link>
          <h1 className="text-xl font-semibold text-gray-900">{plan.title}</h1>
        </div>
        <span
          className={`mt-1 px-2 py-0.5 rounded text-xs font-medium ${STATUS_STYLE[status]}`}
        >
          {STATUS_LABEL[status]}
        </span>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden mb-6">
        <dl className="divide-y divide-gray-100">
          <div className="px-6 py-4 flex gap-4">
            <dt className="w-40 text-sm font-medium text-gray-500 shrink-0">飛行場所</dt>
            <dd className="text-sm text-gray-900">{plan.location}</dd>
          </div>
          <div className="px-6 py-4 flex gap-4">
            <dt className="w-40 text-sm font-medium text-gray-500 shrink-0">飛行予定日時</dt>
            <dd className="text-sm text-gray-900">
              {new Date(plan.plannedAt).toLocaleString("ja-JP", {
                timeZone: "Asia/Tokyo",
                year: "numeric",
                month: "2-digit",
                day: "2-digit",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </dd>
          </div>
          <div className="px-6 py-4 flex gap-4">
            <dt className="w-40 text-sm font-medium text-gray-500 shrink-0">飛行時間</dt>
            <dd className="text-sm text-gray-900">{plan.durationMin} 分</dd>
          </div>
          <div className="px-6 py-4 flex gap-4">
            <dt className="w-40 text-sm font-medium text-gray-500 shrink-0">飛行目的</dt>
            <dd className="text-sm text-gray-900 whitespace-pre-wrap">{plan.purpose}</dd>
          </div>
          {aircraft && (
            <div className="px-6 py-4 flex gap-4">
              <dt className="w-40 text-sm font-medium text-gray-500 shrink-0">使用機体</dt>
              <dd className="text-sm text-gray-900">
                {aircraft.name} ({aircraft.manufacturer})
              </dd>
            </div>
          )}
        </dl>
      </div>

      {risk && (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden mb-6">
          <div className="px-6 py-3 bg-gray-50 border-b border-gray-200">
            <h2 className="text-sm font-medium text-gray-700">リスク情報（スタブ）</h2>
          </div>
          <div className="px-6 py-4 grid grid-cols-2 gap-6 text-sm">
            <div>
              <p className="font-medium text-gray-600 mb-2">天気</p>
              <dl className="space-y-1 text-gray-700">
                <div className="flex gap-2">
                  <dt className="text-gray-500 w-24 shrink-0">天候</dt>
                  <dd>{risk.weather.condition}</dd>
                </div>
                <div className="flex gap-2">
                  <dt className="text-gray-500 w-24 shrink-0">風速</dt>
                  <dd>{risk.weather.windSpeedMs} m/s</dd>
                </div>
                <div className="flex gap-2">
                  <dt className="text-gray-500 w-24 shrink-0">気温</dt>
                  <dd>{risk.weather.temperatureCelsius} °C</dd>
                </div>
              </dl>
            </div>
            <div>
              <p className="font-medium text-gray-600 mb-2">ハザード</p>
              <dl className="space-y-1 text-gray-700">
                <div className="flex gap-2">
                  <dt className="text-gray-500 w-24 shrink-0">墜落距離</dt>
                  <dd>{risk.hazard.fallDistanceM.toFixed(1)} m</dd>
                </div>
                <div className="flex gap-2">
                  <dt className="text-gray-500 w-24 shrink-0">空港近傍</dt>
                  <dd>{risk.hazard.nearAirport ? "はい" : "いいえ"}</dd>
                </div>
                <div className="flex gap-2">
                  <dt className="text-gray-500 w-24 shrink-0">NOTAM</dt>
                  <dd>{risk.hazard.notamNote}</dd>
                </div>
              </dl>
            </div>
          </div>
        </div>
      )}

      <div className="flex gap-3">
        {isAdmin && status === "DRAFT" && (
          <>
            <StatusUpdateButton
              planId={plan.id}
              nextStatus="APPROVED"
              label="承認"
              variant="primary"
            />
            <StatusUpdateButton
              planId={plan.id}
              nextStatus="REJECTED"
              label="却下"
              variant="danger"
            />
          </>
        )}
        {isAdmin && status === "APPROVED" && (
          <StatusUpdateButton
            planId={plan.id}
            nextStatus="REJECTED"
            label="却下"
            variant="danger"
          />
        )}
        {!isAdmin && isOwnPlan && status === "APPROVED" && (
          <StatusUpdateButton
            planId={plan.id}
            nextStatus="COMPLETED"
            label="完了にする"
            variant="success"
          />
        )}
      </div>
    </div>
  );
}
