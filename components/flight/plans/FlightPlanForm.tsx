"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createFlightPlan, updateFlightPlan } from "@/lib/api/flightPlan";
import type { FlightPlanDto } from "@/lib/api/flightPlan";
import { toJstIso, toJstDatetimeLocal, getJstNowAsDatetimeLocal } from "@/lib/utils/jstDatetime";

interface AircraftOption {
  id: string;
  name: string;
  manufacturer: string;
}

interface FlightPlanFormProps {
  aircrafts: AircraftOption[];
  /** 指定時は編集モード。使用機体は更新APIが受け付けないため変更不可として扱う */
  initialData?: FlightPlanDto;
}

interface FormState {
  aircraftId: string;
  title: string;
  location: string;
  plannedAt: string;
  durationMin: string;
  purpose: string;
}

export function FlightPlanForm({ aircrafts, initialData }: FlightPlanFormProps) {
  const router = useRouter();
  const isEdit = initialData !== undefined;

  const [form, setForm] = useState<FormState>({
    aircraftId: initialData?.aircraftId ?? aircrafts[0]?.id ?? "",
    title: initialData?.title ?? "",
    location: initialData?.location ?? "",
    plannedAt: initialData ? toJstDatetimeLocal(initialData.plannedAt) : "",
    durationMin: String(initialData?.durationMin ?? ""),
    purpose: initialData?.purpose ?? "",
  });
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      if (isEdit && initialData) {
        const plan = await updateFlightPlan(initialData.id, {
          title: form.title,
          location: form.location,
          plannedAt: toJstIso(form.plannedAt),
          durationMin: Number(form.durationMin),
          purpose: form.purpose,
        });
        router.push(`/flight/plans/${plan.id}`);
      } else {
        const plan = await createFlightPlan({
          aircraftId: form.aircraftId,
          title: form.title,
          location: form.location,
          plannedAt: toJstIso(form.plannedAt),
          durationMin: Number(form.durationMin),
          purpose: form.purpose,
        });
        router.push(`/flight/plans/${plan.id}`);
      }
      router.refresh();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : isEdit ? "更新に失敗しました" : "作成に失敗しました"
      );
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-w-lg">
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
          disabled={isEdit}
          className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
        >
          {aircrafts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name} ({a.manufacturer})
            </option>
          ))}
        </select>
        {isEdit && <p className="mt-1 text-xs text-gray-500">使用機体は編集できません</p>}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="title">
          タイトル
        </label>
        <input
          id="title"
          name="title"
          type="text"
          value={form.title}
          onChange={handleChange}
          required
          className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
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
          className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="plannedAt">
          飛行予定日時
        </label>
        <input
          id="plannedAt"
          name="plannedAt"
          type="datetime-local"
          value={form.plannedAt}
          onChange={handleChange}
          // 編集時は過去日時の既存計画でも他項目を修正・保存できるよう min を外す
          // (サーバー側も更新時の過去日時を許容する仕様)
          min={isEdit ? undefined : getJstNowAsDatetimeLocal()}
          required
          className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="durationMin">
          飛行時間（分）
        </label>
        <input
          id="durationMin"
          name="durationMin"
          type="number"
          min="1"
          value={form.durationMin}
          onChange={handleChange}
          required
          className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="purpose">
          飛行目的
        </label>
        <textarea
          id="purpose"
          name="purpose"
          value={form.purpose}
          onChange={handleChange}
          required
          rows={3}
          className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div className="flex gap-3 pt-2">
        <button
          type="submit"
          disabled={isSubmitting}
          className="px-4 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 disabled:opacity-50"
        >
          {isSubmitting ? "保存中..." : isEdit ? "更新する" : "飛行計画を作成"}
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
