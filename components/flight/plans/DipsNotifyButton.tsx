"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
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

/** DIPS ログイン遷移でページを離れる間、フォーム入力を退避する sessionStorage キー */
const PENDING_NOTIFY_STORAGE_KEY = "dips:pendingNotifyForm";

interface PendingNotifyState {
  planId: string;
  form: FormState;
}

interface BannerState {
  type: "success" | "error";
  message: string;
}

/** 退避済みフォームを読み出す。この計画のものでない・壊れている場合は null */
function loadPendingNotifyForm(planId: string): FormState | null {
  try {
    const raw = window.sessionStorage.getItem(PENDING_NOTIFY_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PendingNotifyState> | null;
    if (parsed?.planId !== planId || typeof parsed.form !== "object" || parsed.form === null) {
      return null;
    }
    // 将来 FormState の項目が変わっても壊れないよう、既定値にマージする
    return { ...INITIAL_FORM, ...parsed.form };
  } catch {
    return null;
  }
}

/** フォーム入力を退避する。sessionStorage が使えない環境では何もしない */
function savePendingNotifyForm(planId: string, form: FormState): void {
  try {
    const state: PendingNotifyState = { planId, form };
    window.sessionStorage.setItem(PENDING_NOTIFY_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // プライベートモード等で保存できない場合、復元なしでログインへ進む
  }
}

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
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isOpen, setIsOpen] = useState(false);
  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [banner, setBanner] = useState<BannerState | null>(null);

  // Escape キーでダイアログを閉じる (アクセシビリティ対応)
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsOpen(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  // DIPS 認可フローから戻ってきたとき (?dips=...) に退避済みフォームを復元し、
  // 連携成功時はそのまま自動で通報を再送信する。
  // sessionStorage の削除をこの effect の先頭 (自動送信の開始前) で行うことで、
  // 同一クエリに対して effect が複数回実行されても savedForm が null になり、
  // 二重送信を防止できる (加えて isSubmitting 中はボタン自体も無効化する)。
  // 復元後に router.replace でクエリを除去するため、この effect は2回目の実行で
  // 早期リターンし、無限ループにはならない。
  useEffect(() => {
    const dipsResult = searchParams.get("dips");
    if (!dipsResult) return;

    const savedForm = loadPendingNotifyForm(planId);
    window.sessionStorage.removeItem(PENDING_NOTIFY_STORAGE_KEY);

    if (dipsResult === "linked") {
      if (savedForm) {
        setForm(savedForm);
        setIsOpen(true);
        setBanner({
          type: "success",
          message: "DIPS連携が完了しました。入力内容を復元し、通報を自動で再送信しています...",
        });
        void resubmitAfterDipsLink(savedForm);
      } else {
        setBanner({ type: "success", message: "DIPS連携が完了しました。" });
      }
    } else {
      // 失敗時も入力は復元し、再入力の手間を減らす (モーダルは自動で開かない)
      if (savedForm) setForm(savedForm);
      setBanner({
        type: "error",
        message:
          dipsResult === "state_error"
            ? "DIPS連携の検証に失敗しました。もう一度お試しください。"
            : "DIPS連携に失敗しました。もう一度お試しください。",
      });
    }

    // リロード時の再処理と URL の汚れを防ぐため dips クエリを取り除く
    router.replace(pathname, { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- resubmitAfterDipsLink は planId/router に対して安定
  }, [searchParams, planId, pathname, router]);

  /**
   * OAuth 復帰後、退避していたフォーム内容で通報を自動再送信する。
   * 復元データが不正な場合や再送信が失敗した場合は、ループさせず
   * 手動での再送信 (「通報する」ボタン) を促すバナーに切り替える。
   */
  async function resubmitAfterDipsLink(savedForm: FormState): Promise<void> {
    const validated = validateAndBuildInput(savedForm);
    if (!validated.ok) {
      setBanner({
        type: "error",
        message: `DIPS連携が完了しましたが、復元した入力内容に不備があります (${validated.message})。内容を確認のうえ、再度「通報する」を押してください。`,
      });
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      await notifyFlightPlanToDips(planId, validated.input);
      setIsOpen(false);
      setBanner({ type: "success", message: "DIPS連携が完了し、飛行計画の通報を自動で送信しました。" });
      router.refresh();
    } catch (err) {
      // 自動再送信が失敗した場合は、DipsAuthRequiredClientError であっても
      // 再度ログイン画面へは遷移させず (無限ループ防止)、手動操作を促す
      const detail = err instanceof Error ? err.message : "不明なエラー";
      setBanner({
        type: "error",
        message: `DIPS連携が完了しましたが、通報の自動再送信に失敗しました (${detail})。内容を確認のうえ、再度「通報する」を押してください。`,
      });
    } finally {
      setIsSubmitting(false);
    }
  }

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
        // トークン未取得・失効: フォーム入力を退避し、連携後にこのページへ
        // 戻れるよう returnPath を添えて DIPS ログイン画面へ誘導する
        savePendingNotifyForm(planId, form);
        window.location.href = dipsLoginUrl(err.realm, window.location.pathname);
        return;
      }
      setError(err instanceof Error ? err.message : "DIPS通報に失敗しました");
      setIsSubmitting(false);
    }
  };

  const bannerElement = banner && (
    <p
      // 支援技術ユーザーにも連携結果が伝わるよう live region として通知する
      role={banner.type === "success" ? "status" : "alert"}
      className={`mb-3 text-sm ${banner.type === "success" ? "text-success" : "text-danger"}`}
    >
      {banner.message}
    </p>
  );

  return (
    <div>
      {!isOpen && bannerElement}
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

            {bannerElement}
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
