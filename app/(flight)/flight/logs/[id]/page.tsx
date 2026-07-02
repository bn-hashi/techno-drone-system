import Link from "next/link";
import { notFound } from "next/navigation";
import { getFlightLogService } from "@/lib/serviceFactory";
import { requireFlightSession } from "@/lib/auth/requireFlightSession";
import { FlightLogNotFoundError } from "@/services/errors";
import { formatFlightDateTime } from "@/lib/utils/formatFlightDateTime";
import {
  INSPECTION_ITEM_LABELS,
  INSPECTION_RESULT_LABELS,
  INSPECTION_PHASE_LABELS,
} from "@/lib/constants/inspectionItems";
import type { InspectionItemKey } from "@/lib/constants/inspectionItems";
import { InspectionPhase } from "@/types/prisma";
import type { FlightInspection } from "@prisma/client";

interface FlightLogDetailPageProps {
  params: { id: string };
}

export const dynamic = "force-dynamic";

function InspectionSection({
  phase,
  inspections,
}: {
  phase: InspectionPhase;
  inspections: FlightInspection[];
}) {
  const entries = inspections.filter((inspection) => inspection.phase === phase);
  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden mb-6">
      <div className="px-6 py-3 bg-gray-50 border-b border-gray-200">
        <h2 className="text-sm font-medium text-gray-700">{INSPECTION_PHASE_LABELS[phase]}</h2>
      </div>
      {entries.length === 0 ? (
        <p className="px-6 py-4 text-sm text-gray-500">点検記録なし</p>
      ) : (
        <dl className="divide-y divide-gray-100">
          {entries.map((inspection) => (
            <div key={inspection.id} className="px-6 py-3 flex gap-4 text-sm">
              <dt className="w-56 text-gray-500 shrink-0">
                {INSPECTION_ITEM_LABELS[inspection.itemKey as InspectionItemKey] ??
                  inspection.itemKey}
              </dt>
              <dd className="text-gray-900">
                {INSPECTION_RESULT_LABELS[inspection.result]}
                {inspection.note && <span className="text-gray-500 ml-2">{inspection.note}</span>}
              </dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}

export default async function FlightLogDetailPage({ params }: FlightLogDetailPageProps) {
  const { userId, isAdmin } = await requireFlightSession();

  let log;
  try {
    log = await getFlightLogService().findByIdForPdf(params.id, { userId, isAdmin });
  } catch (err) {
    if (err instanceof FlightLogNotFoundError) {
      notFound();
    }
    throw err;
  }

  return (
    <div className="p-6 max-w-2xl">
      <div className="flex justify-between items-start mb-6">
        <div>
          <Link
            href="/flight/logs"
            className="text-sm text-blue-600 hover:underline mb-1 inline-block"
          >
            ← 飛行日誌一覧
          </Link>
          <h1 className="text-xl font-semibold text-gray-900">
            飛行日誌 {formatFlightDateTime(new Date(log.startedAt))}
          </h1>
        </div>
        <a
          href={`/api/flight/logs/${log.id}/pdf`}
          className="px-4 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
        >
          PDF ダウンロード
        </a>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden mb-6">
        <dl className="divide-y divide-gray-100">
          <div className="px-6 py-4 flex gap-4">
            <dt className="w-40 text-sm font-medium text-gray-500 shrink-0">操縦者</dt>
            <dd className="text-sm text-gray-900">{log.user.name}</dd>
          </div>
          <div className="px-6 py-4 flex gap-4">
            <dt className="w-40 text-sm font-medium text-gray-500 shrink-0">使用機体</dt>
            <dd className="text-sm text-gray-900">
              {log.aircraft.name} ({log.aircraft.manufacturer})
              {log.aircraft.registrationNumber && ` / ${log.aircraft.registrationNumber}`}
            </dd>
          </div>
          {log.flightPlan && (
            <div className="px-6 py-4 flex gap-4">
              <dt className="w-40 text-sm font-medium text-gray-500 shrink-0">関連飛行計画</dt>
              <dd className="text-sm text-gray-900">{log.flightPlan.title}</dd>
            </div>
          )}
          <div className="px-6 py-4 flex gap-4">
            <dt className="w-40 text-sm font-medium text-gray-500 shrink-0">飛行場所</dt>
            <dd className="text-sm text-gray-900">{log.location}</dd>
          </div>
          <div className="px-6 py-4 flex gap-4">
            <dt className="w-40 text-sm font-medium text-gray-500 shrink-0">飛行時間</dt>
            <dd className="text-sm text-gray-900">
              {formatFlightDateTime(new Date(log.startedAt))} 〜{" "}
              {formatFlightDateTime(new Date(log.endedAt))} ({log.durationMin} 分)
            </dd>
          </div>
          {log.pilotNote && (
            <div className="px-6 py-4 flex gap-4">
              <dt className="w-40 text-sm font-medium text-gray-500 shrink-0">操縦者メモ</dt>
              <dd className="text-sm text-gray-900 whitespace-pre-wrap">{log.pilotNote}</dd>
            </div>
          )}
          {log.incidentNote && (
            <div className="px-6 py-4 flex gap-4">
              <dt className="w-40 text-sm font-medium text-gray-500 shrink-0">不具合・事故等</dt>
              <dd className="text-sm text-gray-900 whitespace-pre-wrap">{log.incidentNote}</dd>
            </div>
          )}
        </dl>
      </div>

      <InspectionSection phase={InspectionPhase.PRE_FLIGHT} inspections={log.inspections} />
      <InspectionSection phase={InspectionPhase.POST_FLIGHT} inspections={log.inspections} />
    </div>
  );
}
