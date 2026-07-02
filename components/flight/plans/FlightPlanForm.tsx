"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createFlightPlan } from "@/lib/api/flightPlan";
import { toJstIso, getJstNowAsDatetimeLocal } from "@/lib/utils/jstDatetime";

interface AircraftOption {
  id: string;
  name: string;
  manufacturer: string;
}

interface FlightPlanFormProps {
  aircrafts: AircraftOption[];
}

interface FormState {
  aircraftId: string;
  title: string;
  location: string;
  plannedAt: string;
  durationMin: string;
  purpose: string;
}

export function FlightPlanForm({ aircrafts }: FlightPlanFormProps) {
  const router = useRouter();
  const [form, setForm] = useState<FormState>({
    aircraftId: aircrafts[0]?.id ?? "",
    title: "",
    location: "",
    plannedAt: "",
    durationMin: "",
    purpose: "",
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
      const plan = await createFlightPlan({
        aircraftId: form.aircraftId,
        title: form.title,
        location: form.location,
        plannedAt: toJstIso(form.plannedAt),
        durationMin: Number(form.durationMin),
        purpose: form.purpose,
      });
      router.push(`/flight/plans/${plan.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "作成に失敗しました");
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
          className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {aircrafts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name} ({a.manufacturer})
            </option>
          ))}
        </select>
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
          min={getJstNowAsDatetimeLocal()}
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
          {isSubmitting ? "作成中..." : "飛行計画を作成"}
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
