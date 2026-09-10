"use client";

import type { DipsNotificationInput } from "@/lib/api/dips";
import {
  DIPS_FLIGHT_PURPOSE_OPTIONS,
  DIPS_FLIGHT_PURPOSE_OTHER_BUSINESS,
  DIPS_FLIGHT_PURPOSE_OTHER_NON_BUSINESS,
} from "@/lib/constants/dipsFlightPurpose";
import { DIPS_PREFECTURE_OPTIONS } from "@/lib/constants/dipsAddressCode";
import { DIPS_FLIGHT_AIRSPACE_OPTIONS } from "@/lib/constants/dipsFlightAirspace";
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
  // No.7 は任意 (－)。既定でDID上空 (1) を主張すると、許可・承認情報を送らないこの画面の
  // 設計と矛盾する (req-013 差し戻し J2)。利用者が該当するものだけを選ぶ
  flightAirspace: "",
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

type ValidationResult = { ok: true; input: DipsNotificationInput } | { ok: false; message: string };

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

  // No.7 は任意 (－)。特定飛行 (DID上空/150m以上/空港周辺) のいずれにも該当しない
  // 通常の飛行は空配列が正しい値のため、ここで「1つ以上選択必須」にしてはならない
  // (req-013 差し戻し J2)
  const flightAirspace = form.flightAirspace
    .split(",")
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isInteger(n) && n > 0);
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

/** `FormState` の1フィールドを更新する。各サブコンポーネントに共通で渡す */
type SetField = <K extends keyof FormState>(key: K, value: FormState[K]) => void;

interface FieldsetProps {
  form: FormState;
  setField: SetField;
}

/** 飛行目的 (複数選択) + その他1/その他2 が選択されたときだけ表示する理由入力欄 */
function PurposeFieldset({
  form,
  setField,
  onTogglePurpose,
}: FieldsetProps & { onTogglePurpose: (code: number) => void }) {
  const showOtherBusinessReason = form.flightPurpose.includes(DIPS_FLIGHT_PURPOSE_OTHER_BUSINESS);
  const showOtherNonBusinessReason = form.flightPurpose.includes(
    DIPS_FLIGHT_PURPOSE_OTHER_NON_BUSINESS
  );

  return (
    <>
      <fieldset>
        <legend className="mb-1 font-medium text-body">飛行目的 (複数選択可)</legend>
        <div className="grid grid-cols-2 gap-1">
          {DIPS_FLIGHT_PURPOSE_OPTIONS.map((option) => (
            <label key={option.code} className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={form.flightPurpose.includes(option.code)}
                onChange={() => onTogglePurpose(option.code)}
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
    </>
  );
}

/** 補助者人数・速度・出発地/目的地・高度 (既存項目。req-013 段階3では変更なし) */
function FlightBasicsFields({ form, setField }: FieldsetProps) {
  return (
    <>
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
    </>
  );
}

/**
 * 飛行空域 (2.3.8 No.7, 任意)。該当するものだけを選ぶ複数選択のチェックボックス。
 *
 * req-013 差し戻し J2: 以前は自由入力欄 (カンマ区切り) で既定値が "1" (DID上空) だった
 * ため、利用者が書き換えない限り毎回「許可・承認を要する特定飛行」を主張する矛盾した
 * 内容が送信されていた。No.7 は必須ではなく任意のため、既定は「いずれも選択しない」
 * (空配列) にし、コードの意味が一目でわかるようチェックボックスの選択式にした
 * (凡例を別途添える案もあったが、ラベル自体に意味を書くほうが誤りにくいため選択式を採用)。
 * 内部表現は `FormState.flightAirspace: string` (カンマ区切り) のまま変更しない
 * (ファイル冒頭のコメントの通り、既存フィールドの型変更は sessionStorage 経由の
 * 復元データとの互換性リスクがあるため)。
 */
function FlightAirspaceFieldset({ form, setField }: FieldsetProps) {
  const selectedCodes = form.flightAirspace
    .split(",")
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isInteger(n) && n > 0);

  const toggleCode = (code: number) => {
    const next = selectedCodes.includes(code)
      ? selectedCodes.filter((c) => c !== code)
      : [...selectedCodes, code];
    setField("flightAirspace", next.join(","));
  };

  return (
    <fieldset className="rounded border border-line-soft p-3">
      <legend className="px-1 text-xs text-muted">飛行空域 (該当するものだけを選択)</legend>
      <div className="space-y-1">
        {DIPS_FLIGHT_AIRSPACE_OPTIONS.map((option) => (
          <label key={option.code} className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={selectedCodes.includes(option.code)}
              onChange={() => toggleCode(option.code)}
            />
            <span>{option.label}</span>
          </label>
        ))}
      </div>
      <p className="mt-2 text-xs text-muted">
        いずれかに該当する場合、許可・承認が必要な特定飛行です。本画面では許可・承認情報を
        送信できないため、そのような飛行は通報できません。
      </p>
    </fieldset>
  );
}

/** 飛行範囲 (円: 中心座標と半径。既存項目。req-012 で地図入力化予定) */
function FlyRouteFieldset({ form, setField }: FieldsetProps) {
  return (
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
  );
}

/** 安全措置5種 (立入管理措置・同レベル3/3.5・立入禁止措置・係留飛行) (2.3.8 No.27-31) */
function SafetyMeasuresFieldset({ form, setField }: FieldsetProps) {
  return (
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
  );
}

/**
 * 通報者・操縦者 (同一人物) の連絡先。都道府県・住所・電話番号 (2.3.8 No.43-46/54-57)。
 * 氏名・メールは User レコードから送るため入力欄を持たない (新規PIIを最小限にする)。
 */
function ContactFieldset({ form, setField }: FieldsetProps) {
  return (
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
  );
}

/** 技能証明3種 (一等・二等・技能認証) (2.3.8 No.60-62) */
function SkillCertificationFieldset({ form, setField }: FieldsetProps) {
  return (
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
  );
}

/**
 * DIPS 飛行計画通報ダイアログの入力欄本体。状態 (`form`) は親 (`DipsNotifyButton`) が持つ
 * (OAuth 往復中の sessionStorage 退避・復元をボタン側で行うため)。このコンポーネントは
 * 各セクションのサブコンポーネントを並べるだけの薄い合成役に留め、入力欄の実体は
 * 上記のサブコンポーネントへ分割している (関数の行数を抑え、セクション単位で見通しを保つ)。
 */
export function DipsNotifyForm({ form, onFormChange }: DipsNotifyFormProps) {
  const setField: SetField = (key, value) => {
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

  return (
    <div className="space-y-4 text-sm">
      <PurposeFieldset form={form} setField={setField} onTogglePurpose={togglePurpose} />
      <FlightBasicsFields form={form} setField={setField} />
      <FlightAirspaceFieldset form={form} setField={setField} />
      <FlyRouteFieldset form={form} setField={setField} />
      <SafetyMeasuresFieldset form={form} setField={setField} />
      <ContactFieldset form={form} setField={setField} />
      <SkillCertificationFieldset form={form} setField={setField} />
      <p className="text-xs text-muted">許可・承認を要する飛行はこの画面から通報できません。</p>
    </div>
  );
}
