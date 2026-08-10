import { z } from "zod";
import { DipsApiError } from "@/lib/dips/errors";
import type {
  DipsAircraftInfo,
  DipsManufactureCategory,
  DipsUaType,
  DipsUaStatus,
  DipsDeregistrationReason,
  DipsRemoteIdType,
  DipsOwnerCategory,
  DipsUserCategory,
} from "@/lib/dips/types";

/**
 * DRS API (機体情報一覧取得, §2.3.6) の生レスポンスを検証・正規化する境界。
 *
 * 個人情報の遮断点: aircraft_information / owner_information / user_information の
 * うち本システムが使う項目のみをスキーマに定義する。Zod の z.object() は既定で
 * 未定義キーを除去する (strip) ため、氏名・住所・電話番号等の個人情報フィールドは
 * スキーマに書かないだけで自動的に破棄される (.strict() は使わない)。
 *
 * 「リモートID発信方式」(別紙1 項番39) は現行ガイドライン (1.2版) 本体にキー名の
 * 記載がなく不明のため、意図的にスキーマへ含めない (2026-08-01 人の決定。寛容パース)。
 * これにより、この項目を含む (あるいは他の未知キーを含む) レスポンスでもパースは
 * 失敗しない。将来この項目が必要になった場合は DIPS 申請窓口へキー名を再照会すること。
 *
 * コード値 (ステータス・区分等) は JSON 上で数値/文字列のどちらで返るかガイドライン
 * から断定できないため、両方を受理して number へ正規化する。
 */

const RAW_CODE = z.union([z.string(), z.number()]);

/** コード値 (数値/文字列) を number へ正規化する。数値化できない値はパースエラーにする */
const codeNumber = RAW_CODE.transform((value, ctx) => {
  const num = typeof value === "number" ? value : Number(value);
  if (Number.isNaN(num)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "コード値が数値ではありません" });
    return z.NEVER;
  }
  return num;
});

/** 空文字を null に正規化しつつ、それ以外はコード値を number へ正規化する (抹消理由用) */
const nullableCodeNumber = RAW_CODE.transform((value, ctx) => {
  if (typeof value === "string" && value.trim() === "") return null;
  const num = typeof value === "number" ? value : Number(value);
  if (Number.isNaN(num)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "コード値が数値ではありません" });
    return z.NEVER;
  }
  return num;
});

/** 空文字を null に正規化する自由記述項目用 (抹消理由の「その他の理由」) */
const nullableFreeText = z.string().transform((value) => (value === "" ? null : value));

/** 使用者種別 ("" | "1" | "9") を文字列へ正規化する。数値で返る場合も文字列化する */
const userCategoryCode = RAW_CODE.transform((value) =>
  typeof value === "number" ? String(value) : value
);

const AircraftInformationSchema = z.object({
  registration_code: z.string(),
  manufacturing_number: z.string(),
  manufacturing_category: codeNumber,
  aircraft_type: codeNumber,
  manufacturer_jpn: z.string(),
  model_jpn: z.string(),
  manufacturer_eng: z.string(),
  model_eng: z.string(),
  aircraft_weight: codeNumber,
  maximum_takeoff_weight: codeNumber,
  aircraft_status: codeNumber,
  erase_reason_number: nullableCodeNumber,
  erase_reason_other: nullableFreeText,
  effectiveness_period_self: z.string(),
  effectiveness_period_to: z.string(),
  rid_type: codeNumber,
});

const OwnerInformationSchema = z.object({
  owner_classification: codeNumber,
});

const UserInformationSchema = z.object({
  user_classification: userCategoryCode,
});

const AircraftEntrySchema = z.object({
  aircraft_information: AircraftInformationSchema,
  owner_information: OwnerInformationSchema,
  user_information: UserInformationSchema,
});

/** レスポンスはトップレベルが配列 (0件の場合は []) */
const AircraftListResponseSchema = z.array(AircraftEntrySchema);

type AircraftEntry = z.infer<typeof AircraftEntrySchema>;

function toAircraftInfo(entry: AircraftEntry): DipsAircraftInfo {
  const ai = entry.aircraft_information;
  const oi = entry.owner_information;
  const ui = entry.user_information;
  return {
    regSymbol: ai.registration_code,
    serialNumber: ai.manufacturing_number,
    manufactureCategory: ai.manufacturing_category as DipsManufactureCategory,
    uaType: ai.aircraft_type as DipsUaType,
    makerNameJa: ai.manufacturer_jpn,
    modelNameJa: ai.model_jpn,
    makerNameEn: ai.manufacturer_eng,
    modelNameEn: ai.model_eng,
    weightKg: ai.aircraft_weight,
    maxTakeoffWeightKg: ai.maximum_takeoff_weight,
    uaStatus: ai.aircraft_status as DipsUaStatus,
    deregistrationReason: ai.erase_reason_number as DipsDeregistrationReason | null,
    deregistrationReasonOther: ai.erase_reason_other,
    remoteIdType: ai.rid_type as DipsRemoteIdType,
    validPeriodStart: ai.effectiveness_period_self,
    validPeriodEnd: ai.effectiveness_period_to,
    ownerCategory: oi.owner_classification as DipsOwnerCategory,
    userCategory: ui.user_classification as DipsUserCategory,
  };
}

/** Zod のパス (キー名) のみを連結する。受信値そのものは一切含めない */
function formatIssuePaths(error: z.ZodError): string {
  return error.issues.map((issue) => issue.path.join(".")).join(", ");
}

/**
 * DRS API の生レスポンス (機体情報一覧取得) を検証し、DipsAircraftInfo[] へ正規化する。
 * 形式不正時は DipsApiError を投げる。エラーメッセージには Zod のキー名のみを含め、
 * 受信値 (個人情報を含みうる) は一切含めない。
 */
export function normalizeAircraftList(raw: unknown): DipsAircraftInfo[] {
  const result = AircraftListResponseSchema.safeParse(raw);
  if (!result.success) {
    throw new DipsApiError(
      `DIPS機体情報のレスポンス形式が不正です (対象キー: ${formatIssuePaths(result.error)})`
    );
  }
  return result.data.map(toAircraftInfo);
}
