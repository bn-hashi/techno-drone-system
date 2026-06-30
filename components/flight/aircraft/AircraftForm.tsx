"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { AircraftDto, AircraftFormData } from "@/lib/api/aircraft";
import { createAircraft, updateAircraft } from "@/lib/api/aircraft";

interface AircraftFormProps {
  initialData?: AircraftDto;
}

export function AircraftForm({ initialData }: AircraftFormProps) {
  const router = useRouter();
  const isEdit = initialData !== undefined;

  const [form, setForm] = useState<AircraftFormData>({
    name: initialData?.name ?? "",
    manufacturer: initialData?.manufacturer ?? "",
    modelNumber: initialData?.modelNumber ?? "",
    serialNumber: initialData?.serialNumber ?? "",
    weightGrams: initialData?.weightGrams ?? 0,
    maxFlightTimeMin: initialData?.maxFlightTimeMin ?? 0,
    registrationNumber: initialData?.registrationNumber ?? "",
  });
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: type === "number" ? Number(value) : value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      if (isEdit && initialData) {
        await updateAircraft(initialData.id, form);
        router.push(`/flight/aircraft/${initialData.id}`);
      } else {
        const created = await createAircraft(form);
        router.push(`/flight/aircraft/${created.id}`);
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "エラーが発生しました");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-w-lg">
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
          {error}
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          機体名 <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          name="name"
          value={form.name}
          onChange={handleChange}
          required
          className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          製造メーカー <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          name="manufacturer"
          value={form.manufacturer}
          onChange={handleChange}
          required
          className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          型式番号 <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          name="modelNumber"
          value={form.modelNumber}
          onChange={handleChange}
          required
          className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          シリアル番号 <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          name="serialNumber"
          value={form.serialNumber}
          onChange={handleChange}
          required
          disabled={isEdit}
          className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          機体重量 (g) <span className="text-red-500">*</span>
        </label>
        <input
          type="number"
          name="weightGrams"
          value={form.weightGrams}
          onChange={handleChange}
          required
          min={1}
          className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          最大飛行時間 (分) <span className="text-red-500">*</span>
        </label>
        <input
          type="number"
          name="maxFlightTimeMin"
          value={form.maxFlightTimeMin}
          onChange={handleChange}
          required
          min={1}
          className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          登録記号（国土交通省）
        </label>
        <input
          type="text"
          name="registrationNumber"
          value={form.registrationNumber ?? ""}
          onChange={handleChange}
          className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div className="flex gap-3 pt-2">
        <button
          type="submit"
          disabled={isSubmitting}
          className="px-4 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 disabled:opacity-50"
        >
          {isSubmitting ? "保存中..." : isEdit ? "更新する" : "登録する"}
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
