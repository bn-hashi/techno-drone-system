"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { notifyFlightPlanToDips, dipsLoginUrl, DipsAuthRequiredClientError } from "@/lib/api/dips";
import type { DipsNotificationInput } from "@/lib/api/dips";
import { DIPS_FLIGHT_PURPOSE_OPTIONS } from "@/lib/constants/dipsFlightPurpose";
import { buildCircleFlyRoute } from "@/lib/dips/notificationMapper";

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

/** 数値入力欄をパースし、空欄・非数値・範囲外なら null を返す */
function parseNumberInRange(raw: string, min: number, max: number): number | null {
  if (raw.trim() === "") return null;
  const value = Number(raw);
  if (!Number.isFinite(value) || value < min || value > max) return null;
  return value;
}

/** 入力フォームを検証して API 入力へ変換する。不正があればエラーメッセージを返す */
function validateAndBuildInput(
  form: FormState
): { ok: true; input: DipsNotificationInput } | { ok: false; message: string } {
  if (form.flightPurpose.length === 0) {
    return { ok: false, message: "飛行目的を1つ以上選択してください" };
  }
  const flightAirspace = form.flightAirspace
    .split(",")
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isInteger(n) && n > 0);
  if (flightAirspace.length === 0) {
    return { ok: false, message: "飛行空域種別を入力してください" };
  }
  if (!form.departurePoint.trim() || !form.destinationPoint.trim()) {
    return { ok: false, message: "出発地・目的地を入力してください" };
  }
  const assistantsNumber = parseNumberInRange(form.assistantsNumber, 0, 999);
  const flightSpeed = parseNumberInRange(form.flightSpeed, 1, 999);
  const flightAltitude = parseNumberInRange(form.flightAltitude, 1, 999);
  if (assistantsNumber === null || flightSpeed === null || flightAltitude === null) {
    return {
      ok: false,
      message: "補助者人数・速度 (1〜999)・高度 (1〜999) を正しく入力してください",
    };
  }
  const longitude = parseNumberInRange(form.centerLongitude, -180, 180);
  const latitude = parseNumberInRange(form.centerLatitude, -90, 90);
  const radiusMeters = parseNumberInRange(form.radiusMeters, 1, 1_000_000);
  if (longitude === null || latitude === null || radiusMeters === null) {
    return { ok: false, message: "飛行範囲 (経度・緯度・半径) を正しく入力してください" };
  }
  return {
    ok: true,
    input: {
      flightPurpose: form.flightPurpose,
      flightAirspace,
      assistantsNumber,
      departurePoint: form.departurePoint.trim(),
      destinationPoint: form.destinationPoint.trim(),
      flightSpeed,
      flightAltitude,
      flyRoute: buildCircleFlyRoute(longitude, latitude, radiusMeters),
      riskMitigationOnsiteControl: form.riskMitigationOnsiteControl,
    },
  };
}

export function DipsNotifyButton({ planId, dipsFlightPlanId }: DipsNotifyButtonProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Escape キーでダイアログを閉じる (アクセシビリティ対応)
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsOpen(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

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

    const validated = validateAndBuildInput(form);
    if (!validated.ok) {
      setError(validated.message);
      return;
    }

    setIsSubmitting(true);
    try {
      await notifyFlightPlanToDips(planId, validated.input);
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
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="dips-notify-dialog-title"
            className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-card bg-white p-6"
          >
            <h2 id="dips-notify-dialog-title" className="mb-4 text-lg font-bold text-heading">
              DIPS飛行計画通報
            </h2>
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
