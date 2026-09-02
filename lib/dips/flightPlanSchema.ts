import { z } from "zod";
import { DipsApiError } from "@/lib/dips/errors";
import type { DipsFlightPlanInfo } from "@/lib/dips/types";
import {
  describeReceivedType,
  normalizeEntriesWithDiagnostics,
} from "@/lib/dips/normalizeEntriesWithDiagnostics";

/**
 * 飛行計画情報取得 API (DIPS2.0 API(FPR) 接続システム向けガイドライン v1.9 2.3.6) の
 * 生レスポンスを検証・正規化する境界。`lib/dips/permissionsSchema.ts` と同じ構造
 * (エントリ単位のフォールバック・ログ・全件失敗時の DipsApiError は共通エンジンへ委譲)。
 *
 * 個人情報の遮断点: レスポンスの `reporter` (通報者連絡先)・`pilotInfo[].contactPilot`
 * (操縦者連絡先)・`flightPermitApplicationInfo.contactPermit` (許可申請者連絡先) には
 * 氏名・住所・電話番号・メールアドレスが含まれるが、これらのキーはスキーマに定義しない。
 * z.object() の既定動作 (strip) により自動的に破棄される (`DipsFlightPlanInfo`
 * (lib/dips/types.ts) が最初からこれらのフィールドを型として持たないことと対応する)。
 *
 * ○/● の区別 (FPRガイドライン 2.3.6 備考欄): flightPlanId/startTime/finishTime/
 * plannedMaxTime/plannedFlightTime/flightSpeed/flightAltitude/flyRoute の8項目は
 * 「○ = 全ユーザーの飛行計画で出力」のため常に存在する必須フィールドとして検証する。
 * それ以外 (name/flightPurpose/departurePoint/pilotInfo/aircraftInfo/
 * flightPermitApplicationInfo 等) は「● = 自アカウントの飛行計画のみ出力」のため、
 * 他ユーザーの飛行計画検索 (allFlightPlan: "0", 既定) ではキー自体が省略される。
 * これを厳格な必須フィールドとして検証すると、他ユーザーの飛行計画のほぼ全件が
 * エントリ単位のフォールバックで除外されてしまう (検索結果のほぼ全滅という実害)。
 * そのため ● フィールドはすべて `.nullish()` で「キー自体が無い」ことを許容し、
 * 省略時は `null` に正規化する (DipsFlightPlanInfo のコメント参照)。
 *
 * nested な pilotInfo/aircraftInfo は、5-2 の flightRoutes (経路単位で寛容パース) とは
 * 異なり、要素単位の寛容パースまでは行わない (1件でも形状が想定外ならエントリ全体を
 * 落とす)。5-4 は検証環境へのサンプルデータ投入 (5-6 飛行計画通報受付の成功) が
 * 前提であり、実サンプルに事前到達できていないため、まずは要求どおりの形を求め、
 * 本番疎通確認で寛容化が必要と分かった時点で個別に広げる方針とする
 * (permissionsSchema.ts 冒頭コメントの方針と同じ)。
 */

const FlightPlanGeometrySchema = z.object({
  type: z.enum(["Circle", "Polygon"]),
  center: z
    .array(z.number())
    .nullish()
    .transform((value) => value ?? []),
  radius: z
    .number()
    .nullish()
    .transform((value) => value ?? 0),
  coordinates: z
    .array(z.array(z.number()))
    .nullish()
    .transform((value) => value ?? []),
});

/** 「●」フィールド (自アカウントの飛行計画のみ出力) 共通のヘルパー: 省略時は null */
function nullishField<T extends z.ZodTypeAny>(schema: T) {
  return schema.nullish().transform((value) => value ?? null);
}

const InsuranceInfoSchema = z.object({
  insuranceCompany: z.string(),
  insuranceProduct: z.string(),
  interPerson: z.number(),
  interObject: z.number(),
  insuranceAbility: z.string(),
});

const PilotInfoSchema = z.object({
  pilotId: z.number(),
  skillCertificationNumber: z
    .string()
    .nullish()
    .transform((value) => value ?? ""),
  firstClass: z.string(),
  secondClass: z.string(),
  privateLicense: z.string(),
  maker: z.string(),
  model: z.string(),
});

const AircraftInfoSchema = z.object({
  aircraftId: z.number(),
  type: z.string(),
  certificationNum: z
    .string()
    .nullish()
    .transform((value) => value ?? ""),
  symbol: z.string(),
  model: z.string(),
  maker: z.string(),
  certification1: z.string(),
  certification2: z.string(),
  maxWeight: z.number(),
});

const PermitApplicationInfoSchema = z.object({
  flightPermitApplicationNumber: z.string(),
  permitDate: z.string(),
  startDate: z.string(),
  finishDate: z.string(),
});

const FlightPlanEntrySchema = z.object({
  flightPlanId: z.string(),
  name: nullishField(z.string()),
  flightPurpose: nullishField(z.array(z.number())),
  flightAirspace: nullishField(z.array(z.number())),
  flightType: nullishField(z.array(z.number())),
  assistantsNumber: nullishField(z.number()),
  departurePoint: nullishField(z.string()),
  destinationPoint: nullishField(z.string()),
  startTime: z.string(),
  finishTime: z.string(),
  plannedMaxTime: z.number(),
  plannedFlightTime: z.number(),
  flightSpeed: z.number(),
  flightAltitude: z.number(),
  flyRoute: FlightPlanGeometrySchema,
  riskMitigationOnsiteControl: nullishField(z.string()),
  riskMitigationOnsiteControlL3: nullishField(z.string()),
  riskMitigationOnsiteControlL35: nullishField(z.string()),
  riskMitigationOnsiteControl2: nullishField(z.string()),
  exceptionalConditionsMooring: nullishField(z.string()),
  insuranceInformation: nullishField(InsuranceInfoSchema),
  otherInformation: nullishField(z.string()),
  pilotInfo: nullishField(z.array(PilotInfoSchema)),
  aircraftInfo: nullishField(z.array(AircraftInfoSchema)),
  flightPermitApplicationInfo: nullishField(PermitApplicationInfoSchema),
});

type FlightPlanEntry = z.infer<typeof FlightPlanEntrySchema>;

/** `flightPlanInfo` の値そのもの (配列 または null) を検証するスキーマ */
const FlightPlanListValueSchema = z.array(z.unknown()).nullable();

export interface NormalizeFlightPlansResult {
  flightPlans: DipsFlightPlanInfo[];
  /** パースに失敗して除外した飛行計画の件数 */
  excludedCount: number;
}

function toFlightPlanInfo(entry: FlightPlanEntry): DipsFlightPlanInfo {
  return { ...entry };
}

/**
 * 生レスポンスから `flightPlanInfo` 配列を取り出す。`permissionsSchema.ts` の
 * `extractPermissionsArray` (F1 差し戻し) と同じ方針で、キー自体が無い場合と明示的な
 * null を区別する。
 */
function extractFlightPlanArray(raw: unknown): unknown[] {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    throw new DipsApiError(
      `DIPS飛行計画情報のレスポンス形式が不正です (受信した型: ${describeReceivedType(raw)})`
    );
  }

  if (!Object.prototype.hasOwnProperty.call(raw, "flightPlanInfo")) {
    throw new DipsApiError(
      "DIPS飛行計画情報のレスポンスに flightPlanInfo キーが存在しません (仕様変更またはDIPS接続先の誤りの疑いがあります)"
    );
  }

  const rawValue = (raw as Record<string, unknown>).flightPlanInfo;
  const shapeResult = FlightPlanListValueSchema.safeParse(rawValue);
  if (!shapeResult.success) {
    throw new DipsApiError(
      `DIPS飛行計画情報のレスポンス形式が不正です (flightPlanInfo の値が不正です。受信した型: ${describeReceivedType(rawValue)})`
    );
  }

  return shapeResult.data ?? [];
}

/**
 * 飛行計画情報取得 API の生レスポンスを検証し、DipsFlightPlanInfo[] へ正規化する。
 * 除外した飛行計画の件数も併せて返す (`excludedCount`)。
 */
export function normalizeFlightPlansWithDiagnostics(raw: unknown): NormalizeFlightPlansResult {
  const { entries, excludedCount } = normalizeEntriesWithDiagnostics(raw, {
    entrySchema: FlightPlanEntrySchema,
    extractArray: extractFlightPlanArray,
    subject: "DIPS飛行計画情報",
    route: "normalizeFlightPlans",
  });

  return { flightPlans: entries.map(toFlightPlanInfo), excludedCount };
}
