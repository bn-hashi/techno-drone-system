"use client";

import type { DipsNotificationInput } from "@/lib/api/dips";
import {
  DIPS_FLIGHT_PURPOSE_OPTIONS,
  DIPS_FLIGHT_PURPOSE_OTHER_BUSINESS,
  DIPS_FLIGHT_PURPOSE_OTHER_NON_BUSINESS,
} from "@/lib/constants/dipsFlightPurpose";
import { DIPS_PREFECTURE_OPTIONS } from "@/lib/constants/dipsAddressCode";
import { buildCircleFlyRoute } from "@/lib/dips/notificationMapper";

/**
 * 通報ダイアログのフォーム状態。
 *
 * 既存フィールドの改名・削除は禁止 (req-013 段階3)。DIPS ログイン往復中の入力は
 * sessionStorage (`dips:pendingNotifyForm`, キー定義は DipsNotifyButton.tsx) に
 * 退避されるため、フィールド名を変えるとデプロイを跨いで復元中の利用者の入力が
 * 黙って初期値に戻る (`loadPendingNotifyForm` の `{...INITIAL_FORM, ...parsed.form}`
 * マージ参照)。新規フィールドの追加のみ許可する。
 */
export interface FormState {
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
  riskMitigationOnsiteControlL3: boolean;
  riskMitigationOnsiteControlL35: boolean;
  riskMitigationOnsiteControl2: boolean;
  exceptionalConditionsMooring: boolean;
  prefecture: string;
  municipality: string;
  telephone: string;
  firstClass: boolean;
  secondClass: boolean;
  privateLicense: boolean;
  othergyomutext: string;
  othergyomugaitext: string;
}

export const INITIAL_FORM: FormState = {
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
  riskMitigationOnsiteControlL3: false,
  riskMitigationOnsiteControlL35: false,
  riskMitigationOnsiteControl2: false,
  exceptionalConditionsMooring: false,
  prefecture: "",
  municipality: "",
  telephone: "",
  firstClass: false,
  secondClass: false,
  privateLicense: false,
  othergyomutext: "",
  othergyomugaitext: "",
};

/** 数値入力欄をパースし、空欄・非数値・範囲外なら null を返す */
function parseNumberInRange(raw: string, min: number, max: number): number | null {
  if (raw.trim() === "") return null;
  const value = Number(raw);
  if (!Number.isFinite(value) || value < min || value > max) return null;
  return value;
}

type ValidationResult =
  | { ok: true; input: DipsNotificationInput }
  | { ok: false; message: string };

/** 飛行目的「その他」系が選択されているのに理由が未入力なら、条件付き必須の項目を検証する */
function validateOtherPurposeReasons(form: FormState): ValidationResult | null {
  if (
    form.flightPurpose.includes(DIPS_FLIGHT_PURPOSE_OTHER_BUSINESS) &&
    !form.othergyomutext.trim()
  ) {
    return { ok: false, message: "「その他1(業務)」の理由を入力してください" };
  }
  if (
    form.flightPurpose.includes(DIPS_FLIGHT_PURPOSE_OTHER_NON_BUSINESS) &&
    !form.othergyomugaitext.trim()
  ) {
    return { ok: false, message: "「その他2(業務以外)」の理由を入力してください" };
  }
  return null;
}

/** 入力フォームを検証して API 入力へ変換する。不正があればエラーメッセージを返す */
export function validateAndBuildInput(form: FormState): ValidationResult {
  if (form.flightPurpose.length === 0) {
    return { ok: false, message: "飛行目的を1つ以上選択してください" };
  }
  const otherPurposeError = validateOtherPurposeReasons(form);
  if (otherPurposeError) return otherPurposeError;

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
  if (!form.prefecture || !form.municipality.trim() || !form.telephone.trim()) {
    return { ok: false, message: "都道府県・住所・電話番号を入力してください" };
  }

  return {
    ok: true,
    input: {
      flightPurpose: form.flightPurpose,
      ...(form.flightPurpose.includes(DIPS_FLIGHT_PURPOSE_OTHER_BUSINESS)
        ? { othergyomutext: form.othergyomutext.trim() }
        : {}),
      ...(form.flightPurpose.includes(DIPS_FLIGHT_PURPOSE_OTHER_NON_BUSINESS)
        ? { othergyomugaitext: form.othergyomugaitext.trim() }
        : {}),
      flightAirspace,
      assistantsNumber,
      departurePoint: form.departurePoint.trim(),
      destinationPoint: form.destinationPoint.trim(),
      flightSpeed,
      flightAltitude,
      flyRoute: buildCircleFlyRoute(longitude, latitude, radiusMeters),
      riskMitigationOnsiteControl: form.riskMitigationOnsiteControl,
      riskMitigationOnsiteControlL3: form.riskMitigationOnsiteControlL3,
      riskMitigationOnsiteControlL35: form.riskMitigationOnsiteControlL35,
      riskMitigationOnsiteControl2: form.riskMitigationOnsiteControl2,
      exceptionalConditionsMooring: form.exceptionalConditionsMooring,
      prefecture: form.prefecture,
      municipality: form.municipality.trim(),
      telephone: form.telephone.trim(),
      firstClass: form.firstClass,
      secondClass: form.secondClass,
      privateLicense: form.privateLicense,
    },
  };
}

interface DipsNotifyFormProps {
  form: FormState;
  onFormChange: (updater: (prev: FormState) => FormState) => void;
}

/**
 * DIPS 飛行計画通報ダイアログの入力欄本体。状態 (`form`) は親 (`DipsNotifyButton`) が持つ
 * (OAuth 往復中の sessionStorage 退避・復元をボタン側で行うため)。このコンポーネントは
 * 入力欄の表示と `onFormChange` 経由の更新のみを担う。
 */
export function DipsNotifyForm({ form, onFormChange }: DipsNotifyFormProps) {
  const setField = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    onFormChange((prev) => ({ ...prev, [key]: value }));
  };

  const togglePurpose = (code: number) => {
    onFormChange((prev) => ({
      ...prev,
      flightPurpose: prev.flightPurpose.includes(code)
        ? prev.flightPurpose.filter((c) => c !== code)
        : [...prev.flightPurpose, code],
    }));
  };

  const showOtherBusinessReason = form.flightPurpose.includes(DIPS_FLIGHT_PURPOSE_OTHER_BUSINESS);
  const showOtherNonBusinessReason = form.flightPurpose.includes(
    DIPS_FLIGHT_PURPOSE_OTHER_NON_BUSINESS
  );

  return (
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

      {showOtherBusinessReason && (
        <label className="block">
          <span className="mb-1 block font-medium text-body">その他1(業務)の理由</span>
          <input
            type="text"
            value={form.othergyomutext}
            onChange={(e) => setField("othergyomutext", e.target.value)}
            className="w-full rounded border border-line px-2 py-1"
          />
        </label>
      )}

      {showOtherNonBusinessReason && (
        <label className="block">
          <span className="mb-1 block font-medium text-body">その他2(業務以外)の理由</span>
          <input
            type="text"
            value={form.othergyomugaitext}
            onChange={(e) => setField("othergyomugaitext", e.target.value)}
            className="w-full rounded border border-line px-2 py-1"
          />
        </label>
      )}

      <label className="block">
        <span className="mb-1 block font-medium text-body">飛行空域種別 (カンマ区切り)</span>
        <input
          type="text"
          value={form.flightAirspace}
          onChange={(e) => setField("flightAirspace", e.target.value)}
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
            onChange={(e) => setField("assistantsNumber", e.target.value)}
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
            onChange={(e) => setField("flightSpeed", e.target.value)}
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
            onChange={(e) => setField("departurePoint", e.target.value)}
            className="w-full rounded border border-line px-2 py-1"
          />
        </label>
        <label className="block">
          <span className="mb-1 block font-medium text-body">目的地</span>
          <input
            type="text"
            value={form.destinationPoint}
            onChange={(e) => setField("destinationPoint", e.target.value)}
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
          onChange={(e) => setField("flightAltitude", e.target.value)}
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
              onChange={(e) => setField("centerLongitude", e.target.value)}
              className="w-full rounded border border-line px-2 py-1"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs text-body">緯度</span>
            <input
              type="number"
              step="any"
              value={form.centerLatitude}
              onChange={(e) => setField("centerLatitude", e.target.value)}
              className="w-full rounded border border-line px-2 py-1"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs text-body">半径 (m)</span>
            <input
              type="number"
              min={1}
              value={form.radiusMeters}
              onChange={(e) => setField("radiusMeters", e.target.value)}
              className="w-full rounded border border-line px-2 py-1"
            />
          </label>
        </div>
      </fieldset>

      <fieldset className="rounded border border-line-soft p-3">
        <legend className="px-1 text-xs text-muted">安全措置</legend>
        <div className="space-y-1">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={form.riskMitigationOnsiteControl}
              onChange={(e) => setField("riskMitigationOnsiteControl", e.target.checked)}
            />
            <span>立入管理措置を講じる</span>
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={form.riskMitigationOnsiteControlL3}
              onChange={(e) => setField("riskMitigationOnsiteControlL3", e.target.checked)}
            />
            <span>立入管理措置(レベル3飛行)を講じる</span>
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={form.riskMitigationOnsiteControlL35}
              onChange={(e) => setField("riskMitigationOnsiteControlL35", e.target.checked)}
            />
            <span>立入管理措置(レベル3.5飛行関連)を講じる</span>
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={form.riskMitigationOnsiteControl2}
              onChange={(e) => setField("riskMitigationOnsiteControl2", e.target.checked)}
            />
            <span>立入禁止措置を講じる</span>
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={form.exceptionalConditionsMooring}
              onChange={(e) => setField("exceptionalConditionsMooring", e.target.checked)}
            />
            <span>係留飛行を行う</span>
          </label>
        </div>
      </fieldset>

      <fieldset className="rounded border border-line-soft p-3 space-y-3">
        <legend className="px-1 text-xs text-muted">通報者・操縦者の連絡先</legend>
        <p className="text-xs text-muted">
          氏名・メールアドレスはログイン中のアカウント情報を送信します。
          通報者と操縦者は同一人物として送信します。
        </p>
        <label className="block">
          <span className="mb-1 block font-medium text-body">都道府県</span>
          <select
            value={form.prefecture}
            onChange={(e) => setField("prefecture", e.target.value)}
            className="w-full rounded border border-line px-2 py-1"
          >
            <option value="">選択してください</option>
            {DIPS_PREFECTURE_OPTIONS.map((option) => (
              <option key={option.code} value={option.code}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block font-medium text-body">住所（市町村以下）</span>
          <input
            type="text"
            value={form.municipality}
            onChange={(e) => setField("municipality", e.target.value)}
            className="w-full rounded border border-line px-2 py-1"
          />
        </label>
        <label className="block">
          <span className="mb-1 block font-medium text-body">電話番号</span>
          <input
            type="text"
            value={form.telephone}
            onChange={(e) => setField("telephone", e.target.value)}
            className="w-full rounded border border-line px-2 py-1"
          />
        </label>
      </fieldset>

      <fieldset className="rounded border border-line-soft p-3">
        <legend className="px-1 text-xs text-muted">技能証明</legend>
        <div className="space-y-1">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={form.firstClass}
              onChange={(e) => setField("firstClass", e.target.checked)}
            />
            <span>技能証明(一等)を保有している</span>
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={form.secondClass}
              onChange={(e) => setField("secondClass", e.target.checked)}
            />
            <span>技能証明(二等)を保有している</span>
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={form.privateLicense}
              onChange={(e) => setField("privateLicense", e.target.checked)}
            />
            <span>技能認証を保有している</span>
          </label>
          <p className="text-xs text-muted">
            技能認証は2025年12月の制度改正により将来的に廃止予定の項目です。
          </p>
        </div>
      </fieldset>

      <p className="text-xs text-muted">許可・承認を要する飛行はこの画面から通報できません。</p>
    </div>
  );
}
