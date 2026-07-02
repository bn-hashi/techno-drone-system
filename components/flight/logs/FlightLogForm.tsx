"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createFlightLog } from "@/lib/api/flightLog";
import type { FlightLogInspectionInput } from "@/lib/api/flightLog";
import { toJstIso, getJstNowAsDatetimeLocal } from "@/lib/utils/jstDatetime";
import {
  INSPECTION_ITEMS,
  INSPECTION_RESULT_LABELS,
  INSPECTION_PHASE_LABELS,
} from "@/lib/constants/inspectionItems";
import { InspectionPhase, InspectionResult } from "@/types/prisma";

interface AircraftOption {
  id: string;
  name: string;
  manufacturer: string;
}

interface FlightPlanOption {
  id: string;
  title: string;
}

interface FlightLogFormProps {
  aircrafts: AircraftOption[];
  completedPlans: FlightPlanOption[];
}

interface FormState {
  aircraftId: string;
  flightPlanId: string;
  startedAt: string;
  endedAt: string;
  location: string;
  pilotNote: string;
  incidentNote: string;
}

type InspectionResults = Record<InspectionPhase, Record<string, InspectionResult>>;

const PHASES = [InspectionPhase.PRE_FLIGHT, InspectionPhase.POST_FLIGHT] as const;

const RESULT_OPTIONS = [
  InspectionResult.PASS,
  InspectionResult.FAIL,
  InspectionResult.NA,
] as const;

function buildInitialInspections(): InspectionResults {
  const perPhase = () =>
    Object.fromEntries(INSPECTION_ITEMS.map((item) => [item.key, InspectionResult.PASS]));
  return {
    [InspectionPhase.PRE_FLIGHT]: perPhase(),
    [InspectionPhase.POST_FLIGHT]: perPhase(),
  };
}

export function FlightLogForm({ aircrafts, completedPlans }: FlightLogFormProps) {
  const router = useRouter();
  const [form, setForm] = useState<FormState>({
    aircraftId: aircrafts[0]?.id ?? "",
    flightPlanId: "",
    startedAt: "",
    endedAt: "",
    location: "",
    pilotNote: "",
    incidentNote: "",
  });
  const [inspections, setInspections] = useState<InspectionResults>(buildInitialInspections);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleInspectionChange = (
    phase: InspectionPhase,
    itemKey: string,
    result: InspectionResult
  ) => {
    setInspections((prev) => ({
      ...prev,
      [phase]: { ...prev[phase], [itemKey]: result },
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      const inspectionList: FlightLogInspectionInput[] = PHASES.flatMap((phase) =>
        INSPECTION_ITEMS.map((item) => ({
          phase,
          itemKey: item.key,
          result: inspections[phase][item.key],
        }))
      );
      const log = await createFlightLog({
        aircraftId: form.aircraftId,
        flightPlanId: form.flightPlanId || null,
        startedAt: toJstIso(form.startedAt),
        endedAt: toJstIso(form.endedAt),
        location: form.location,
        pilotNote: form.pilotNote || null,
        incidentNote: form.incidentNote || null,
        inspections: inspectionList,
      });
      router.push(`/flight/logs/${log.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "作成に失敗しました");
      setIsSubmitting(false);
    }
  };

  const inputClassName =
    "w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500";

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-w-2xl">
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">
          {error}
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="aircraftId">
          使用機体
        </label>
        <select
          id="aircraftId"
          name="aircraftId"
          value={form.aircraftId}
          onChange={handleChange}
          required
          className={inputClassName}
        >
          {aircrafts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name} ({a.manufacturer})
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="flightPlanId">
          関連する飛行計画（任意）
        </label>
        <select
          id="flightPlanId"
          name="flightPlanId"
          value={form.flightPlanId}
          onChange={handleChange}
          className={inputClassName}
        >
          <option value="">選択しない</option>
          {completedPlans.map((plan) => (
            <option key={plan.id} value={plan.id}>
              {plan.title}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="startedAt">
            飛行開始日時
          </label>
          <input
            id="startedAt"
            name="startedAt"
            type="datetime-local"
            value={form.startedAt}
            onChange={handleChange}
            max={getJstNowAsDatetimeLocal()}
            required
            className={inputClassName}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="endedAt">
            飛行終了日時
          </label>
          <input
            id="endedAt"
            name="endedAt"
            type="datetime-local"
            value={form.endedAt}
            onChange={handleChange}
            min={form.startedAt || undefined}
            required
            className={inputClassName}
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="location">
          飛行場所
        </label>
        <input
          id="location"
          name="location"
          type="text"
          value={form.location}
          onChange={handleChange}
          required
          className={inputClassName}
        />
      </div>

      {PHASES.map((phase) => (
        <fieldset key={phase} className="border border-gray-200 rounded p-4">
          <legend className="text-sm font-medium text-gray-700 px-1">
            {INSPECTION_PHASE_LABELS[phase]}
          </legend>
          <div className="space-y-2">
            {INSPECTION_ITEMS.map((item) => (
              <div key={item.key} className="flex items-center justify-between gap-4">
                <span className="text-sm text-gray-700">{item.label}</span>
                <div className="flex gap-3">
                  {RESULT_OPTIONS.map((result) => (
                    <label key={result} className="flex items-center gap-1 text-sm text-gray-600">
                      <input
                        type="radio"
                        name={`${phase}-${item.key}`}
                        checked={inspections[phase][item.key] === result}
                        onChange={() => handleInspectionChange(phase, item.key, result)}
                      />
                      {INSPECTION_RESULT_LABELS[result]}
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </fieldset>
      ))}

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="pilotNote">
          操縦者メモ（任意）
        </label>
        <textarea
          id="pilotNote"
          name="pilotNote"
          value={form.pilotNote}
          onChange={handleChange}
          rows={2}
          className={inputClassName}
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="incidentNote">
          不具合・事故等（任意）
        </label>
        <textarea
          id="incidentNote"
          name="incidentNote"
          value={form.incidentNote}
          onChange={handleChange}
          rows={2}
          className={inputClassName}
        />
      </div>

      <div className="flex gap-3 pt-2">
        <button
          type="submit"
          disabled={isSubmitting}
          className="px-4 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 disabled:opacity-50"
        >
          {isSubmitting ? "作成中..." : "飛行日誌を作成"}
        </button>
        <button
          type="button"
          onClick={() => router.back()}
          className="px-4 py-2 border border-gray-300 text-sm rounded hover:bg-gray-50"
        >
          キャンセル
        </button>
      </div>
    </form>
  );
}
