"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { notifyFlightPlanToDips, dipsLoginUrl, DipsAuthRequiredClientError } from "@/lib/api/dips";
import type { DipsNotificationInput } from "@/lib/api/dips";
import { DIPS_FLIGHT_PURPOSE_OPTIONS } from "@/lib/constants/dipsFlightPurpose";

interface DipsNotifyButtonProps {
  planId: string;
  /** 通報済みなら DIPS 採番の飛行計画 ID。未通報は null */
  dipsFlightPlanId: string | null;
}

interface FormState {
  flightPurpose: number[];
  flightAirspace: string;
  assistantsNumber: string;
  departurePoint: string;
  destinationPoint: string;
  flightSpeed: string;
  flightAltitude: string;
  centerLongitude: string;
  centerLatitude: string;
  radiusMeters: string;
  riskMitigationOnsiteControl: boolean;
}

const INITIAL_FORM: FormState = {
  flightPurpose: [],
  flightAirspace: "1",
  assistantsNumber: "0",
  departurePoint: "",
  destinationPoint: "",
  flightSpeed: "",
  flightAltitude: "",
  centerLongitude: "",
  centerLatitude: "",
  radiusMeters: "",
  riskMitigationOnsiteControl: true,
};

// FPRガイドライン 2.3.8 の Circle 型 flyRoute (GeoJSON) を組み立てる
function buildCircleFlyRoute(longitude: number, latitude: number, radiusMeters: number): string {
  return JSON.stringify({
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        properties: { radius: radiusMeters },
        geometry: { type: "Circle", center: [longitude, latitude] },
      },
    ],
  });
}

export function DipsNotifyButton({ planId, dipsFlightPlanId }: DipsNotifyButtonProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (dipsFlightPlanId) {
    return <p className="text-sm text-success">DIPS通報済み (飛行計画ID: {dipsFlightPlanId})</p>;
  }

  const togglePurpose = (code: number) => {
    setForm((prev) => ({
      ...prev,
      flightPurpose: prev.flightPurpose.includes(code)
        ? prev.flightPurpose.filter((c) => c !== code)
        : [...prev.flightPurpose, code],
    }));
  };

  const handleSubmit = async () => {
    setError(null);

    if (form.flightPurpose.length === 0) {
      setError("飛行目的を1つ以上選択してください");
      return;
    }

    const input: DipsNotificationInput = {
      flightPurpose: form.flightPurpose,
      flightAirspace: form.flightAirspace
        .split(",")
        .map((s) => Number(s.trim()))
        .filter((n) => Number.isInteger(n)),
      assistantsNumber: Number(form.assistantsNumber),
      departurePoint: form.departurePoint.trim(),
      destinationPoint: form.destinationPoint.trim(),
      flightSpeed: Number(form.flightSpeed),
      flightAltitude: Number(form.flightAltitude),
      flyRoute: buildCircleFlyRoute(
        Number(form.centerLongitude),
        Number(form.centerLatitude),
        Number(form.radiusMeters)
      ),
      riskMitigationOnsiteControl: form.riskMitigationOnsiteControl,
    };

    setIsSubmitting(true);
    try {
      await notifyFlightPlanToDips(planId, input);
      setIsOpen(false);
      router.refresh();
    } catch (err) {
      if (err instanceof DipsAuthRequiredClientError) {
        // トークン未取得・失効: DIPS ログイン画面へ誘導
        window.location.href = dipsLoginUrl(err.realm);
        return;
      }
      setError(err instanceof Error ? err.message : "DIPS通報に失敗しました");
      setIsSubmitting(false);
    }
  };

  return (
    <div>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="rounded bg-accent px-3 py-1.5 text-sm text-white hover:opacity-90"
      >
        DIPSへ通報
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-card bg-white p-6">
            <h2 className="mb-4 text-lg font-bold text-heading">DIPS飛行計画通報</h2>
            <p className="mb-4 text-xs text-muted">
              飛行計画の名称・日時・機体はこの計画から自動送信されます。以下は追加で必要な項目です。
            </p>

            {error && <p className="mb-3 text-sm text-danger">{error}</p>}

            <div className="space-y-4 text-sm">
              <fieldset>
                <legend className="mb-1 font-medium text-body">飛行目的 (複数選択可)</legend>
                <div className="grid grid-cols-2 gap-1">
                  {DIPS_FLIGHT_PURPOSE_OPTIONS.map((option) => (
                    <label key={option.code} className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={form.flightPurpose.includes(option.code)}
                        onChange={() => togglePurpose(option.code)}
                      />
                      <span>{option.label}</span>
                    </label>
                  ))}
                </div>
              </fieldset>

              <label className="block">
                <span className="mb-1 block font-medium text-body">
                  飛行空域種別 (カンマ区切り)
                </span>
                <input
                  type="text"
                  value={form.flightAirspace}
                  onChange={(e) => setForm({ ...form, flightAirspace: e.target.value })}
                  className="w-full rounded border border-line px-2 py-1"
                />
              </label>

              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="mb-1 block font-medium text-body">補助者人数</span>
                  <input
                    type="number"
                    min={0}
                    value={form.assistantsNumber}
                    onChange={(e) => setForm({ ...form, assistantsNumber: e.target.value })}
                    className="w-full rounded border border-line px-2 py-1"
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block font-medium text-body">飛行速度 (km/h)</span>
                  <input
                    type="number"
                    min={1}
                    max={999}
                    value={form.flightSpeed}
                    onChange={(e) => setForm({ ...form, flightSpeed: e.target.value })}
                    className="w-full rounded border border-line px-2 py-1"
                  />
                </label>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="mb-1 block font-medium text-body">出発地</span>
                  <input
                    type="text"
                    value={form.departurePoint}
                    onChange={(e) => setForm({ ...form, departurePoint: e.target.value })}
                    className="w-full rounded border border-line px-2 py-1"
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block font-medium text-body">目的地</span>
                  <input
                    type="text"
                    value={form.destinationPoint}
                    onChange={(e) => setForm({ ...form, destinationPoint: e.target.value })}
                    className="w-full rounded border border-line px-2 py-1"
                  />
                </label>
              </div>

              <label className="block">
                <span className="mb-1 block font-medium text-body">飛行高度 (AGL メートル)</span>
                <input
                  type="number"
                  min={1}
                  max={999}
                  value={form.flightAltitude}
                  onChange={(e) => setForm({ ...form, flightAltitude: e.target.value })}
                  className="w-full rounded border border-line px-2 py-1"
                />
              </label>

              <fieldset className="rounded border border-line-soft p-3">
                <legend className="px-1 text-xs text-muted">飛行範囲 (円: 中心と半径)</legend>
                <div className="grid grid-cols-3 gap-2">
                  <label className="block">
                    <span className="mb-1 block text-xs text-body">経度</span>
                    <input
                      type="number"
                      step="any"
                      value={form.centerLongitude}
                      onChange={(e) => setForm({ ...form, centerLongitude: e.target.value })}
                      className="w-full rounded border border-line px-2 py-1"
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-xs text-body">緯度</span>
                    <input
                      type="number"
                      step="any"
                      value={form.centerLatitude}
                      onChange={(e) => setForm({ ...form, centerLatitude: e.target.value })}
                      className="w-full rounded border border-line px-2 py-1"
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-xs text-body">半径 (m)</span>
                    <input
                      type="number"
                      min={1}
                      value={form.radiusMeters}
                      onChange={(e) => setForm({ ...form, radiusMeters: e.target.value })}
                      className="w-full rounded border border-line px-2 py-1"
                    />
                  </label>
                </div>
              </fieldset>

              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={form.riskMitigationOnsiteControl}
                  onChange={(e) =>
                    setForm({ ...form, riskMitigationOnsiteControl: e.target.checked })
                  }
                />
                <span>立入管理措置を講じる</span>
              </label>
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                disabled={isSubmitting}
                className="rounded border border-line px-3 py-1.5 text-sm text-body disabled:opacity-50"
              >
                キャンセル
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="rounded bg-accent px-3 py-1.5 text-sm text-white disabled:opacity-50"
              >
                {isSubmitting ? "通報中..." : "通報する"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
