"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { AircraftDto, AircraftFormData } from "@/lib/api/aircraft";
import { createAircraft, updateAircraft } from "@/lib/api/aircraft";
import type { DipsOwnedAircraftDto } from "@/lib/api/dips";
import { DipsAircraftPickerModal } from "@/components/flight/aircraft/DipsAircraftPickerModal";
import { DIPS_AIRCRAFT_TYPE_OPTIONS } from "@/lib/constants/dipsAircraftType";

interface AircraftFormProps {
  initialData?: AircraftDto;
}

interface FormState {
  name: string;
  manufacturer: string;
  modelNumber: string;
  serialNumber: string;
  weightGrams: string;
  maxFlightTimeMin: string;
  registrationNumber: string;
  /** DIPS 機体の種類コード (1〜6)。未設定は空文字 */
  dipsUaType: string;
  hasDipsCertification1: boolean;
  hasDipsCertification2: boolean;
  dipsCertificationNumber: string;
  /** DIPS 総重量(kg)算出用の最大離陸重量 (g)。未設定は空文字 */
  maxTakeoffWeightGrams: string;
}

/** null 許容の数値項目を、未設定 (null/undefined) は空文字にしてフォーム入力欄へ渡す */
function numberOrNullToFormValue(value: number | null | undefined): string {
  return value === null || value === undefined ? "" : String(value);
}

/** フォーム入力欄の文字列 (空文字は未設定) を null 許容の数値へ戻す */
function formValueToNumberOrNull(value: string): number | null {
  return value === "" ? null : Number(value);
}

export function AircraftForm({ initialData }: AircraftFormProps) {
  const router = useRouter();
  const isEdit = initialData !== undefined;

  const [form, setForm] = useState<FormState>({
    name: initialData?.name ?? "",
    manufacturer: initialData?.manufacturer ?? "",
    modelNumber: initialData?.modelNumber ?? "",
    serialNumber: initialData?.serialNumber ?? "",
    weightGrams: String(initialData?.weightGrams ?? ""),
    maxFlightTimeMin: String(initialData?.maxFlightTimeMin ?? ""),
    registrationNumber: initialData?.registrationNumber ?? "",
    dipsUaType: numberOrNullToFormValue(initialData?.dipsUaType),
    hasDipsCertification1: initialData?.hasDipsCertification1 ?? false,
    hasDipsCertification2: initialData?.hasDipsCertification2 ?? false,
    dipsCertificationNumber: initialData?.dipsCertificationNumber ?? "",
    maxTakeoffWeightGrams: numberOrNullToFormValue(initialData?.maxTakeoffWeightGrams),
  });
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDipsModalOpen, setIsDipsModalOpen] = useState(false);
  const [dipsImportNotice, setDipsImportNotice] = useState<string | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, checked } = e.target;
    setForm((prev) => ({ ...prev, [name]: checked }));
  };

  /**
   * DIPS から選択した機体でフォームを上書きする。
   *
   * serialNumber は編集モードでも常に DIPS 側の値で上書きする (2026-08-10 差し戻しで修正)。
   * 従来は編集モードで serialNumber を据え置いていたため、登録記号だけが DIPS の値に
   * 変わり「DIPS 上に存在しない登録記号×製造番号の組み合わせ」が保存されてしまう
   * バグがあった。入力欄自体は編集モードで disabled のまま (手入力による書き換えは
   * 許可しない) だが、DIPS 取り込みは明示的なユーザー操作であり、取り込む以上は
   * 登録記号・製造番号を DIPS 側のペアとして揃えるべきという判断による。重複した
   * 製造番号は既存の 409 エラー表示に任せる (計画書 §10 論点6)。
   *
   * weightGrams は DIPS 側が値を返せなかった (null) 場合、"null" という文字列を
   * 数値入力欄に入れてしまわないよう上書きせず既存値を維持する。
   * 機体名・最大飛行時間は DIPS に無いためユーザー入力のまま残す。
   */
  const handleDipsSelect = (aircraft: DipsOwnedAircraftDto) => {
    setForm((prev) => ({
      ...prev,
      manufacturer: aircraft.manufacturer,
      modelNumber: aircraft.modelNumber,
      serialNumber: aircraft.serialNumber,
      weightGrams: aircraft.weightGrams !== null ? String(aircraft.weightGrams) : prev.weightGrams,
      registrationNumber: aircraft.registrationCode,
    }));
    setIsDipsModalOpen(false);
    setDipsImportNotice("DIPSから取り込みました。機体名と最大飛行時間を入力してください。");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      const submitData: AircraftFormData = {
        name: form.name,
        manufacturer: form.manufacturer,
        modelNumber: form.modelNumber,
        serialNumber: form.serialNumber,
        weightGrams: Number(form.weightGrams),
        maxFlightTimeMin: Number(form.maxFlightTimeMin),
        registrationNumber: form.registrationNumber || null,
        dipsUaType: formValueToNumberOrNull(form.dipsUaType),
        hasDipsCertification1: form.hasDipsCertification1,
        hasDipsCertification2: form.hasDipsCertification2,
        dipsCertificationNumber: form.dipsCertificationNumber || null,
        maxTakeoffWeightGrams: formValueToNumberOrNull(form.maxTakeoffWeightGrams),
      };
      if (isEdit && initialData) {
        await updateAircraft(initialData.id, submitData);
        router.push(`/flight/aircraft/${initialData.id}`);
      } else {
        const created = await createAircraft(submitData);
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
        <label htmlFor="aircraft-name" className="block text-sm font-medium text-gray-700 mb-1">
          機体名 <span className="text-red-500">*</span>
        </label>
        <input
          id="aircraft-name"
          type="text"
          name="name"
          value={form.name}
          onChange={handleChange}
          required
          className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div>
        <label
          htmlFor="aircraft-manufacturer"
          className="block text-sm font-medium text-gray-700 mb-1"
        >
          製造メーカー <span className="text-red-500">*</span>
        </label>
        <input
          id="aircraft-manufacturer"
          type="text"
          name="manufacturer"
          value={form.manufacturer}
          onChange={handleChange}
          required
          className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div>
        <label
          htmlFor="aircraft-model-number"
          className="block text-sm font-medium text-gray-700 mb-1"
        >
          型式番号 <span className="text-red-500">*</span>
        </label>
        <input
          id="aircraft-model-number"
          type="text"
          name="modelNumber"
          value={form.modelNumber}
          onChange={handleChange}
          required
          className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div>
        <label
          htmlFor="aircraft-serial-number"
          className="block text-sm font-medium text-gray-700 mb-1"
        >
          シリアル番号 <span className="text-red-500">*</span>
        </label>
        <input
          id="aircraft-serial-number"
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
        <label
          htmlFor="aircraft-weight-grams"
          className="block text-sm font-medium text-gray-700 mb-1"
        >
          機体重量 (g) <span className="text-red-500">*</span>
        </label>
        <input
          id="aircraft-weight-grams"
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
        <label
          htmlFor="aircraft-max-flight-time"
          className="block text-sm font-medium text-gray-700 mb-1"
        >
          最大飛行時間 (分) <span className="text-red-500">*</span>
        </label>
        <input
          id="aircraft-max-flight-time"
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
        <div className="flex items-center justify-between mb-1">
          <label
            htmlFor="aircraft-registration-number"
            className="block text-sm font-medium text-gray-700"
          >
            登録記号（国土交通省）
          </label>
          <button
            type="button"
            onClick={() => {
              setDipsImportNotice(null);
              setIsDipsModalOpen(true);
            }}
            className="text-xs text-blue-600 hover:underline"
          >
            DIPSから取り込む
          </button>
        </div>
        <input
          id="aircraft-registration-number"
          type="text"
          name="registrationNumber"
          value={form.registrationNumber}
          onChange={handleChange}
          className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        {dipsImportNotice && (
          <p className="mt-1 text-xs text-green-700">{dipsImportNotice}</p>
        )}
      </div>

      <fieldset className="border border-gray-200 rounded p-3 space-y-3">
        <legend className="px-1 text-xs font-medium text-gray-500">
          DIPS飛行計画通報用の情報（未入力の場合、通報時に入力を求められます）
        </legend>

        <div>
          <label htmlFor="aircraft-dips-ua-type" className="block text-sm font-medium text-gray-700 mb-1">
            機体の種類
          </label>
          <select
            id="aircraft-dips-ua-type"
            name="dipsUaType"
            value={form.dipsUaType}
            onChange={handleChange}
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">未設定</option>
            {DIPS_AIRCRAFT_TYPE_OPTIONS.map((option) => (
              <option key={option.code} value={option.code}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-2">
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              name="hasDipsCertification1"
              checked={form.hasDipsCertification1}
              onChange={handleCheckboxChange}
            />
            機体認証(第一種)を取得している
          </label>
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              name="hasDipsCertification2"
              checked={form.hasDipsCertification2}
              onChange={handleCheckboxChange}
            />
            機体認証(第二種)を取得している
          </label>
        </div>

        <div>
          <label
            htmlFor="aircraft-dips-certification-number"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            機体認証書番号
          </label>
          <input
            id="aircraft-dips-certification-number"
            type="text"
            name="dipsCertificationNumber"
            value={form.dipsCertificationNumber}
            onChange={handleChange}
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label
            htmlFor="aircraft-max-takeoff-weight-grams"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            最大離陸重量 (g)
          </label>
          <input
            id="aircraft-max-takeoff-weight-grams"
            type="number"
            name="maxTakeoffWeightGrams"
            value={form.maxTakeoffWeightGrams}
            onChange={handleChange}
            min={1}
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <p className="mt-1 text-xs text-gray-500">
            未入力の場合、DIPSへの通報時は機体重量を代用します
          </p>
        </div>
      </fieldset>

      <DipsAircraftPickerModal
        isOpen={isDipsModalOpen}
        onClose={() => setIsDipsModalOpen(false)}
        onSelect={handleDipsSelect}
        returnPath={typeof window !== "undefined" ? window.location.pathname : undefined}
      />

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
