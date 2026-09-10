/**
 * FlightPlan → DIPS 飛行計画通報ペイロードへのマッピング補助
 *
 * `buildFlightPlanNotificationPayload()` が FPRガイドライン 2.3.8 の必須51項目すべてを
 * 出力する。この網羅性は `__tests__/lib/dips/flightPlanNotificationPayload.test.ts` の
 * REQUIRED_FIELDS 表で機械的に検証する (2026-07-07 から2か月間、必須項目不足で拒否され
 * 続けた事故の再発防止策)。
 */
import type {
  DipsContactPerson,
  DipsFlightPlanNotificationPayload,
  DipsNotificationUserInput,
} from "@/lib/dips/types";
import {
  DIPS_FLIGHT_PURPOSE_OTHER_BUSINESS,
  DIPS_FLIGHT_PURPOSE_OTHER_NON_BUSINESS,
} from "@/lib/constants/dipsFlightPurpose";
import { DIPS_COUNTRY_CODE_JAPAN } from "@/lib/constants/dipsAddressCode";
import { BusinessError } from "@/services/errors";

const JST_OFFSET_MINUTES = 9 * 60;

/** FPRガイドライン 2.3.8: plannedMaxTime / plannedFlightTime は 5分単位・5〜1440分 */
const DIPS_MINUTES_STEP = 5;
const DIPS_MINUTES_MIN = 5;
const DIPS_MINUTES_MAX = 1440;

/** 飛行計画名称の最大長 (FPRガイドライン 2.3.8 No.3) */
const MAX_FLIGHT_PLAN_NAME_LENGTH = 30;

/**
 * 分数を DIPS の制約 (5分単位・5〜1440) に収める。
 * 端数は安全側 (切り上げ) に丸める。例: 7分 → 10分、1500分 → 1440分。
 */
export function clampToDipsFlightMinutes(minutes: number): number {
  const roundedUp = Math.ceil(minutes / DIPS_MINUTES_STEP) * DIPS_MINUTES_STEP;
  return Math.min(Math.max(roundedUp, DIPS_MINUTES_MIN), DIPS_MINUTES_MAX);
}

/**
 * 所要時間 (plannedFlightTime) が機体の航続可能時間 (plannedMaxTime) を超えていないかを
 * 検証する (req-013 差し戻し J3)。
 *
 * どちらも DIPS の制約 (5分単位・5〜1440) に丸める前の生の値で比較する。丸め後の値
 * (`clampToDipsFlightMinutes` の出力) で比較すると、例えば機体3分/所要4分のような
 * 小さな矛盾が丸めにより一致して (どちらも5分) 見えなくなってしまうため。
 * 機体の航続可能時間より長い飛行計画は物理的に矛盾しており、送信前に検出する。
 */
function assertFlightTimeWithinAircraftRange(
  durationMin: number,
  aircraftMaxFlightTimeMin: number
): void {
  if (durationMin > aircraftMaxFlightTimeMin) {
    throw new BusinessError(
      `飛行の所要時間 (${durationMin}分) が機体の航続可能時間 (${aircraftMaxFlightTimeMin}分) を超えています。飛行計画または機体情報を見直してください`
    );
  }
}

/**
 * 飛行開始日時を DIPS 形式 "yyyyMMdd hhmm" (JST, 半角スペース区切り) に整形する。
 * DB の DateTime は UTC 基準のため JST に変換してから整形する。
 */
export function formatDipsStartTime(date: Date): string {
  const jst = new Date(date.getTime() + JST_OFFSET_MINUTES * 60_000);
  const yyyy = jst.getUTCFullYear();
  const mm = String(jst.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(jst.getUTCDate()).padStart(2, "0");
  const hh = String(jst.getUTCHours()).padStart(2, "0");
  const min = String(jst.getUTCMinutes()).padStart(2, "0");
  return `${yyyy}${mm}${dd} ${hh}${min}`;
}

/**
 * 中心点 (経度・緯度) と半径から Circle 型の flyRoute GeoJSON 文字列を生成する。
 * FPRガイドライン 2.3.8 のサンプルに準拠。
 */
export function buildCircleFlyRoute(
  longitude: number,
  latitude: number,
  radiusMeters: number
): string {
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

/** DIPS の "1"/"0" 文字列フラグの値 (立入管理措置・機体認証など多数の項目で共用) */
const DIPS_FLAG_YES = "1";
const DIPS_FLAG_NO = "0";

/**
 * boolean を DIPS の "1"(講じる/有り)/"0"(講じない/無し) 文字列へ変換する。
 * 立入管理措置・係留飛行・技能証明・機体認証など、FPRガイドライン 2.3.8 全体で
 * 繰り返し使われる "1"/"0" 表現をここへ集約する。
 */
export function toDipsFlag(value: boolean): string {
  return value ? DIPS_FLAG_YES : DIPS_FLAG_NO;
}

/** DIPS 機体重量 (kg) ⇔ 本システムの機体重量 (g) の単位変換係数 (dipsService.ts と共用) */
export const GRAMS_PER_KILOGRAM = 1000;

/** グラム単位の重量を DIPS が要求する kg 単位に変換する (No.73 総重量) */
export function gramsToKilograms(grams: number): number {
  return grams / GRAMS_PER_KILOGRAM;
}

/** 通報者・操縦者 (同一人物) の入力。氏名・メールは User レコードから、住所・電話は
 * 通報ダイアログの都度入力から埋める (新規 PII を DB に保存しない方針)。 */
export interface ContactPersonInput {
  name: string;
  email: string;
  /** 都道府県コード (別紙2) */
  prefecture: string;
  /** 住所 (市町村以下) */
  municipality: string;
  telephone: string;
}

/**
 * 通報者・操縦者の連絡先を組み立てる。国コード・電話国コードは日本固定
 * (本システムの利用者は国内在住が前提。lib/constants/dipsAddressCode.ts のコメント参照)。
 */
function buildContactPerson(person: ContactPersonInput): DipsContactPerson {
  return {
    name: person.name,
    country: DIPS_COUNTRY_CODE_JAPAN,
    prefectures: person.prefecture,
    municipality: person.municipality,
    telephoneCountry: DIPS_COUNTRY_CODE_JAPAN,
    telephone: person.telephone,
    email: person.email,
  };
}

type ReporterField = DipsFlightPlanNotificationPayload["flightPlanInfo"]["reporter"];

/**
 * 通報者情報を組み立てる (No.38-47)。連絡先フラグは常に "1" 固定
 * (ガイドライン備考: 通報者・操縦者・許可承認のいずれか一つが"1"。本システムは
 * 許可承認情報を送らないため、通報者側を連絡先とする一択になる)。
 */
export function buildReporter(person: ContactPersonInput): ReporterField {
  return {
    contactReporterFlag: DIPS_FLAG_YES,
    contactReporter: buildContactPerson(person),
  };
}

/** 操縦者の技能証明申告 (No.60-62)。任意の技能証明書番号 (No.59) は新規PIIのため送らない */
export interface PilotSkillsInput {
  firstClass: boolean;
  secondClass: boolean;
  privateLicense: boolean;
}

/** 操縦者が操縦する代表機体のメーカー・型式 (No.63-64) */
export interface RepresentativeAircraftInput {
  maker: string;
  model: string;
}

type PilotInfoField = DipsFlightPlanNotificationPayload["flightPlanInfo"]["pilotInfo"];

/**
 * 操縦者情報を組み立てる (No.49-64)。req-013 人の決定により、操縦者は通報者と
 * 同一人物として扱い、複数操縦者に対応する作り込みはしない (YAGNI)。常に1件を返す。
 * 連絡先フラグは常に "0" 固定 (buildReporter の "1" と排他)。
 */
export function buildPilotInfo(
  person: ContactPersonInput,
  skills: PilotSkillsInput,
  aircraft: RepresentativeAircraftInput
): PilotInfoField {
  return [
    {
      contactPilotFlag: DIPS_FLAG_NO,
      contactPilot: buildContactPerson(person),
      firstClass: toDipsFlag(skills.firstClass),
      secondClass: toDipsFlag(skills.secondClass),
      privateLicense: toDipsFlag(skills.privateLicense),
      maker: aircraft.maker,
      model: aircraft.model,
    },
  ];
}

/** 機体マスタ (Aircraft) から aircraftInfo (No.65-73) を組み立てるための入力 */
export interface AircraftInfoInput {
  /** DIPS 機体の種類 (1〜6)。DipsService が通報前に null でないことを検証する */
  dipsUaType: number;
  registrationNumber: string;
  modelNumber: string;
  manufacturer: string;
  /** 機体認証(第一種)。マスタの値をそのまま送る (「全機体が未取得」をハードコードしない) */
  hasDipsCertification1: boolean;
  /** 機体認証(第二種)。同上 */
  hasDipsCertification2: boolean;
  dipsCertificationNumber: string | null;
  weightGrams: number;
  maxTakeoffWeightGrams: number | null;
}

type AircraftInfoField = DipsFlightPlanNotificationPayload["flightPlanInfo"]["aircraftInfo"];

/**
 * 機体情報を組み立てる (No.65-73)。総重量 (No.73) は最大離陸重量が設定されていれば
 * それを優先し (ガイドライン備考「困難な場合は最大離陸重量を記載」)、無ければ機体重量を
 * 代用する。常に1件 (通報対象の機体) を返す。
 */
export function buildAircraftInfo(aircraft: AircraftInfoInput): AircraftInfoField {
  const weightGrams = aircraft.maxTakeoffWeightGrams ?? aircraft.weightGrams;
  return [
    {
      type: String(aircraft.dipsUaType),
      ...(aircraft.dipsCertificationNumber
        ? { certificationNum: aircraft.dipsCertificationNumber }
        : {}),
      symbol: aircraft.registrationNumber,
      model: aircraft.modelNumber,
      maker: aircraft.manufacturer,
      certification1: toDipsFlag(aircraft.hasDipsCertification1),
      certification2: toDipsFlag(aircraft.hasDipsCertification2),
      maxWeight: gramsToKilograms(weightGrams),
    },
  ];
}

/** buildFlightPlanNotificationPayload() の入力 */
export interface BuildFlightPlanNotificationPayloadInput {
  /** FlightPlan.title (30文字に切り詰められる) */
  planTitle: string;
  /** FlightPlan.plannedAt (UTC) */
  plannedAt: Date;
  /** FlightPlan.durationMin */
  durationMin: number;
  /** Aircraft.maxFlightTimeMin */
  aircraftMaxFlightTimeMin: number;
  /** 通報ダイアログの入力 */
  userInput: DipsNotificationUserInput;
  /** ログインユーザー (通報者=操縦者) の氏名・メール */
  reporterUser: { name: string; email: string };
  aircraft: AircraftInfoInput;
}

/** その他1/その他2 が選択されているときだけ理由テキストを含める (No.5/6 の条件付き必須) */
function buildOtherPurposeReasons(
  userInput: DipsNotificationUserInput
): Pick<
  DipsFlightPlanNotificationPayload["flightPlanInfo"],
  "othergyomutext" | "othergyomugaitext"
> {
  const reasons: Pick<
    DipsFlightPlanNotificationPayload["flightPlanInfo"],
    "othergyomutext" | "othergyomugaitext"
  > = {};
  if (userInput.flightPurpose.includes(DIPS_FLIGHT_PURPOSE_OTHER_BUSINESS)) {
    reasons.othergyomutext = userInput.othergyomutext ?? "";
  }
  if (userInput.flightPurpose.includes(DIPS_FLIGHT_PURPOSE_OTHER_NON_BUSINESS)) {
    reasons.othergyomugaitext = userInput.othergyomugaitext ?? "";
  }
  return reasons;
}

/** 安全措置4種 + 係留飛行 (No.27-31) を "1"/"0" 文字列へ変換する */
function buildSafetyMeasureFlags(
  userInput: DipsNotificationUserInput
): Pick<
  DipsFlightPlanNotificationPayload["flightPlanInfo"],
  | "riskMitigationOnsiteControl"
  | "riskMitigationOnsiteControlL3"
  | "riskMitigationOnsiteControlL35"
  | "riskMitigationOnsiteControl2"
  | "exceptionalConditionsMooring"
> {
  return {
    riskMitigationOnsiteControl: toDipsFlag(userInput.riskMitigationOnsiteControl),
    riskMitigationOnsiteControlL3: toDipsFlag(userInput.riskMitigationOnsiteControlL3),
    riskMitigationOnsiteControlL35: toDipsFlag(userInput.riskMitigationOnsiteControlL35),
    riskMitigationOnsiteControl2: toDipsFlag(userInput.riskMitigationOnsiteControl2),
    exceptionalConditionsMooring: toDipsFlag(userInput.exceptionalConditionsMooring),
  };
}

export function buildFlightPlanNotificationPayload(
  input: BuildFlightPlanNotificationPayloadInput
): DipsFlightPlanNotificationPayload {
  assertFlightTimeWithinAircraftRange(input.durationMin, input.aircraftMaxFlightTimeMin);

  const person: ContactPersonInput = {
    name: input.reporterUser.name,
    email: input.reporterUser.email,
    prefecture: input.userInput.prefecture,
    municipality: input.userInput.municipality,
    telephone: input.userInput.telephone,
  };

  return {
    flightPlanInfo: {
      flightPlanId: "",
      name: input.planTitle.slice(0, MAX_FLIGHT_PLAN_NAME_LENGTH),
      flightPurpose: input.userInput.flightPurpose,
      ...buildOtherPurposeReasons(input.userInput),
      flightAirspace: input.userInput.flightAirspace,
      assistantsNumber: input.userInput.assistantsNumber,
      departurePoint: input.userInput.departurePoint,
      destinationPoint: input.userInput.destinationPoint,
      startTime: formatDipsStartTime(input.plannedAt),
      plannedMaxTime: clampToDipsFlightMinutes(input.aircraftMaxFlightTimeMin),
      plannedFlightTime: clampToDipsFlightMinutes(input.durationMin),
      flightSpeed: input.userInput.flightSpeed,
      flightAltitude: input.userInput.flightAltitude,
      flyRoute: input.userInput.flyRoute,
      ...buildSafetyMeasureFlags(input.userInput),
      reporter: buildReporter(person),
      pilotInfo: buildPilotInfo(
        person,
        {
          firstClass: input.userInput.firstClass,
          secondClass: input.userInput.secondClass,
          privateLicense: input.userInput.privateLicense,
        },
        { maker: input.aircraft.manufacturer, model: input.aircraft.modelNumber }
      ),
      aircraftInfo: buildAircraftInfo(input.aircraft),
    },
  };
}
