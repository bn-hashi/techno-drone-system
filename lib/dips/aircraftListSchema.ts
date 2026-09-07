import { z } from "zod";
import { DipsApiError } from "@/lib/dips/errors";
import type { DipsAircraftInfo } from "@/lib/dips/types";
import {
  describeReceivedType,
  normalizeEntriesWithDiagnostics,
} from "@/lib/dips/normalizeEntriesWithDiagnostics";

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
 *
 * null 寛容化 (2026-08-10 差し戻しで拡張): 検証環境に事前到達できないため、null・空文字・
 * キー欠落を許容する対象は erase_reason_number/erase_reason_other の2フィールドだけに
 * 留めず、codeNumber/RAW_CODE を使う全フィールドへ広げている。特に user_classification は
 * 「空文字 = 個人」が正常値のドキュメント上の既定値であり (types.ts の DipsUserCategory
 * 参照)、null をエラー扱いにすると個人アカウントのほぼ全機がエントリ単位のフォールバックで
 * 無言で消えてしまう。他のコード値フィールド (ステータス・区分等) は「null に対応する
 * 安全な既定値」が存在しないため、null は number ではなく null へ正規化する
 * (安全な既定値を捏造しない。型は number | null。lib/dips/types.ts 参照)。
 *
 * エントリ単位のフォールバック・ログ・全件失敗時の DipsApiError は
 * `lib/dips/normalizeEntriesWithDiagnostics.ts` の共通エンジンへ委譲する
 * (2026-08-28 段階2共通化。`lib/dips/permissionsSchema.ts` と同じ形)。この境界が
 * 個別に担うのは、生レスポンスからエントリ配列を取り出す `extractAircraftArray` と、
 * 1エントリを検証する `AircraftEntrySchema`、正規化後の DTO へのマッピング
 * (`toAircraftInfo`) の3点のみ。
 */

const RAW_CODE = z.union([z.string(), z.number()]);

/**
 * 空文字・null・キー欠落を null に正規化しつつ、それ以外はコード値を number へ正規化する。
 * 安全な既定値が存在しないコード値フィールド (ステータス・区分等) に使う
 * (A2 差し戻しで全コード値フィールドへ横展開したため、非nullな `codeNumber` バリアントは
 * 使用箇所がなくなり削除した)。
 * - `Number("") === 0` のため空文字は明示的に null 扱いにする (弾かないと
 *   `aircraft_status: ""` のような欠損値が静かに 0 として扱われてしまう)。
 * - `Number("Infinity") === Infinity` は `Number.isNaN` を素通りするため、
 *   `Number.isFinite` で NaN 同様に弾く (Infinity は Math.round 等の後段計算を経て
 *   JSON.stringify で null 化し、クライアント側の検証で不可解に失敗する事故につながる)。
 * `erase_reason_number` は実 API が null で返す可能性を排除できないため寛容側に倒す
 * (検証環境に事前到達できないための判断。2026-08-10 差し戻しで追加)。
 * `codeNumber` と同じ理由で非有限値 (Infinity 等) も弾く。
 */
const nullableCodeNumber = RAW_CODE.nullish().transform((value, ctx) => {
  if (value === null || value === undefined) return null;
  if (typeof value === "string" && value.trim() === "") return null;
  const num = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(num)) {
    ctx.addIssue({ code: "custom", message: "コード値が数値ではありません" });
    return z.NEVER;
  }
  return num;
});

/**
 * 空文字・null・キー欠落を null に正規化する自由記述項目用 (抹消理由の「その他の理由」)。
 * `erase_reason_number` と同じ理由で null・キー欠落も許容する。
 */
const nullableFreeText = z
  .string()
  .nullish()
  .transform((value) => {
    if (value === null || value === undefined || value === "") return null;
    return value;
  });

/**
 * 使用者種別 ("" | "1" | "9") を文字列へ正規化する。数値で返る場合も文字列化する。
 * 空文字が「個人」を表す正常値のドキュメント上の既定であるため (別紙1 項番60)、
 * null・キー欠落も同じ既定値 (空文字) に正規化する。これを怠ると、実 API が null を
 * 返した場合に個人アカウントのほぼ全機がエントリ単位のフォールバックで無言で消える
 * (2026-08-10 差し戻しで追加)。
 */
const userCategoryCode = RAW_CODE.nullish().transform((value) => {
  if (value === null || value === undefined) return "";
  return typeof value === "number" ? String(value) : value;
});

const AircraftInformationSchema = z.object({
  registration_code: z.string(),
  manufacturing_number: z.string(),
  manufacturing_category: nullableCodeNumber,
  aircraft_type: nullableCodeNumber,
  manufacturer_jpn: z.string(),
  model_jpn: z.string(),
  manufacturer_eng: z.string(),
  model_eng: z.string(),
  aircraft_weight: nullableCodeNumber,
  maximum_takeoff_weight: nullableCodeNumber,
  aircraft_status: nullableCodeNumber,
  erase_reason_number: nullableCodeNumber,
  erase_reason_other: nullableFreeText,
  effectiveness_period_self: z.string(),
  effectiveness_period_to: z.string(),
  rid_type: nullableCodeNumber,
});

const OwnerInformationSchema = z.object({
  owner_classification: nullableCodeNumber,
});

const UserInformationSchema = z.object({
  user_classification: userCategoryCode,
});

const AircraftEntrySchema = z.object({
  aircraft_information: AircraftInformationSchema,
  owner_information: OwnerInformationSchema,
  user_information: UserInformationSchema,
});

/** レスポンスはトップレベルが配列であることのみを確認する (中身は要素単位で検証する) */
const RawAircraftListSchema = z.array(z.unknown());

type AircraftEntry = z.infer<typeof AircraftEntrySchema>;

/**
 * 正規化結果と、除外したエントリ件数をあわせて返す。件数だけを上位層 (API レスポンス →
 * UI) へ伝えることで、「所有機体0件」と「一部の機体が異常値で除外された」を UI 側で
 * 区別できるようにする (コードレビュー指摘 C3: 除外が起きても画面には何も表示されず
 * 「機体がありません」と誤解させていた問題への対処)。
 */
export interface NormalizeAircraftListResult {
  aircrafts: DipsAircraftInfo[];
  /** パースに失敗して除外した機体の件数 (個人情報を含む生の値は保持しない) */
  excludedCount: number;
}

function toAircraftInfo(entry: AircraftEntry): DipsAircraftInfo {
  const ai = entry.aircraft_information;
  const oi = entry.owner_information;
  const ui = entry.user_information;
  return {
    regSymbol: ai.registration_code,
    serialNumber: ai.manufacturing_number,
    manufactureCategory: ai.manufacturing_category,
    uaType: ai.aircraft_type,
    makerNameJa: ai.manufacturer_jpn,
    modelNameJa: ai.model_jpn,
    makerNameEn: ai.manufacturer_eng,
    modelNameEn: ai.model_eng,
    weightKg: ai.aircraft_weight,
    maxTakeoffWeightKg: ai.maximum_takeoff_weight,
    uaStatus: ai.aircraft_status,
    deregistrationReason: ai.erase_reason_number,
    deregistrationReasonOther: ai.erase_reason_other,
    remoteIdType: ai.rid_type,
    validPeriodStart: ai.effectiveness_period_self,
    validPeriodEnd: ai.effectiveness_period_to,
    ownerCategory: oi.owner_classification,
    userCategory: ui.user_classification,
  };
}

/**
 * 生レスポンス全体がトップレベル配列であることを確認する (中身の要素単位検証は
 * 共通エンジン側が `AircraftEntrySchema` で行う)。配列でない場合は DipsApiError を
 * 投げる (API 仕様そのものが変わった可能性が高い)。
 */
function extractAircraftArray(raw: unknown): unknown[] {
  const arrayResult = RawAircraftListSchema.safeParse(raw);
  if (!arrayResult.success) {
    throw new DipsApiError(
      `DIPS機体情報のレスポンス形式が不正です (受信した型: ${describeReceivedType(raw)})`
    );
  }
  return arrayResult.data;
}

/**
 * DRS API の生レスポンス (機体情報一覧取得) を検証し、DipsAircraftInfo[] へ正規化する。
 * 除外した機体の件数も併せて返す (`excludedCount`)。上位層はこれを使って
 * 「除外があったのに0件と表示する」誤表示を避けられる (C3)。
 *
 * エントリ単位のフォールバック・ログ・全件失敗時の DipsApiError は共通エンジン
 * (`normalizeEntriesWithDiagnostics`) に委譲する。空配列 ([]) 自体は「所有機体なし」の
 * 正当な応答のため、そのまま [] を返す。エラーメッセージには Zod のキー名または
 * 受信した型名のみを含め、受信値 (個人情報を含みうる) は一切含めない。
 */
export function normalizeAircraftListWithDiagnostics(raw: unknown): NormalizeAircraftListResult {
  const { entries, excludedCount } = normalizeEntriesWithDiagnostics(raw, {
    entrySchema: AircraftEntrySchema,
    extractArray: extractAircraftArray,
    subject: "DIPS機体情報一覧",
    route: "normalizeAircraftList",
  });

  return { aircrafts: entries.map(toAircraftInfo), excludedCount };
}

/**
 * `normalizeAircraftListWithDiagnostics` の後方互換ラッパー。除外件数が不要な
 * 呼び出し元 (既存テスト・単純な用途) 向けに機体配列のみを返す。
 */
export function normalizeAircraftList(raw: unknown): DipsAircraftInfo[] {
  return normalizeAircraftListWithDiagnostics(raw).aircrafts;
}
