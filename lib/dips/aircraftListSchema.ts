import { z } from "zod";
import { DipsApiError } from "@/lib/dips/errors";
import { logger } from "@/lib/logger";
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
 *
 * エントリ単位のフォールバック: レスポンスは複数機体の配列で返るが、そのうち1機の
 * パースが失敗しても他の機体の取得を妨げない (2026-08-10 人の決定。本番疎通確認は
 * IP 制限で実質1回勝負のため、1機の異常値でアカウント全体が 502 になる事態を避ける)。
 * 配列全体ではなくエントリ単位で safeParse し、パースできた機体だけを返す。
 * 落としたエントリは個人情報を含まない形 (配列内インデックスと Zod のパスのみ) で
 * 構造化ログに残す。全件が失敗した場合 (レスポンスが配列であることは確認できたが
 * 1件もパースできない場合) は、レスポンス仕様そのものが変わった可能性が高いため
 * 空配列を返さず DipsApiError を投げる (詳細は normalizeAircraftList のコメント参照)。
 */

const RAW_CODE = z.union([z.string(), z.number()]);

/**
 * コード値 (数値/文字列) を number へ正規化する。数値化できない値 (空文字を含む) は
 * パースエラーにする。`Number("") === 0` のため空文字を明示的に弾く必要がある
 * (弾かないと `aircraft_status: ""` のような欠損値が静かに 0 として扱われてしまう)。
 */
const codeNumber = RAW_CODE.transform((value, ctx) => {
  if (typeof value === "string" && value.trim() === "") {
    ctx.addIssue({ code: "custom", message: "コード値が空文字です" });
    return z.NEVER;
  }
  const num = typeof value === "number" ? value : Number(value);
  if (Number.isNaN(num)) {
    ctx.addIssue({ code: "custom", message: "コード値が数値ではありません" });
    return z.NEVER;
  }
  return num;
});

/**
 * 空文字・null・キー欠落を null に正規化しつつ、それ以外はコード値を number へ正規化する
 * (抹消理由用)。`erase_reason_number` は実 API が null で返す可能性を排除できないため
 * 寛容側に倒す (検証環境に事前到達できないための判断。2026-08-10 差し戻しで追加)。
 */
const nullableCodeNumber = RAW_CODE.nullish().transform((value, ctx) => {
  if (value === null || value === undefined) return null;
  if (typeof value === "string" && value.trim() === "") return null;
  const num = typeof value === "number" ? value : Number(value);
  if (Number.isNaN(num)) {
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

/** レスポンスはトップレベルが配列であることのみを確認する (中身は要素単位で検証する) */
const RawAircraftListSchema = z.array(z.unknown());

type AircraftEntry = z.infer<typeof AircraftEntrySchema>;

/** 1エントリのパースに失敗した際の記録。個人情報を含みうる受信値そのものは持たない */
interface DroppedAircraftEntry {
  /** レスポンス配列内でのインデックス (何番目の機体か) */
  readonly index: number;
  /** 失敗原因となった Zod のパス (キー名) の一覧。値は含めない */
  readonly issuePaths: string[];
}

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

/** Zod のパス (キー名) の一覧を返す。受信値そのものは一切含めない */
function formatIssuePathList(error: z.ZodError): string[] {
  return error.issues.map((issue) => issue.path.join("."));
}

/**
 * 生レスポンスの配列を1件ずつ検証する。配列全体を safeParse すると1件の失敗で
 * 全体が失敗扱いになるため、要素ごとに safeParse してパースできた機体だけを集める。
 */
function parseAircraftEntries(rawEntries: readonly unknown[]): {
  entries: AircraftEntry[];
  failures: DroppedAircraftEntry[];
} {
  const entries: AircraftEntry[] = [];
  const failures: DroppedAircraftEntry[] = [];

  rawEntries.forEach((rawEntry, index) => {
    const result = AircraftEntrySchema.safeParse(rawEntry);
    if (result.success) {
      entries.push(result.data);
    } else {
      failures.push({ index, issuePaths: formatIssuePathList(result.error) });
    }
  });

  return { entries, failures };
}

/**
 * パースに失敗したエントリの情報を構造化ログに残す (本番疎通確認時の切り分け用)。
 * 個人情報の混入を防ぐため、受信値そのものは一切含めず、配列内のインデックスと
 * Zod のパス (キー名) のみを記録する。
 */
function logDroppedAircraftEntries(failures: readonly DroppedAircraftEntry[], totalCount: number): void {
  logger.error(
    `DIPS機体情報一覧のパースで${failures.length}/${totalCount}件のエントリを除外しました`,
    undefined,
    {
      route: "normalizeAircraftList",
      droppedEntries: failures.map((failure) => ({
        index: failure.index,
        issuePaths: failure.issuePaths,
      })),
    }
  );
}

/**
 * DRS API の生レスポンス (機体情報一覧取得) を検証し、DipsAircraftInfo[] へ正規化する。
 *
 * エントリ単位でパースし、1機のパース失敗は他の機体を巻き込まない (パースできた
 * 機体だけを返し、失敗した機体はログに記録して除外する)。以下の場合は DipsApiError
 * を投げる:
 * - レスポンスが配列でない (API 仕様そのものが変わった可能性が高い)
 * - 配列に1件以上の要素があるにもかかわらず、全件のパースに失敗した (個々の機体の
 *   異常値ではなく、レスポンス構造自体の変更を疑うべき状況のため、空配列を返して
 *   「所有機体0件」と誤解させるより502で失敗を可視化する)
 *
 * 空配列 ([]) 自体は「所有機体なし」の正当な応答のため、そのまま [] を返す。
 * エラーメッセージには Zod のキー名のみを含め、受信値 (個人情報を含みうる) は
 * 一切含めない。
 */
export function normalizeAircraftList(raw: unknown): DipsAircraftInfo[] {
  const arrayResult = RawAircraftListSchema.safeParse(raw);
  if (!arrayResult.success) {
    throw new DipsApiError(
      `DIPS機体情報のレスポンス形式が不正です (対象キー: ${formatIssuePathList(arrayResult.error).join(", ")})`
    );
  }

  const { entries, failures } = parseAircraftEntries(arrayResult.data);

  if (failures.length > 0) {
    logDroppedAircraftEntries(failures, arrayResult.data.length);
  }

  if (entries.length === 0 && arrayResult.data.length > 0) {
    const failedKeys = Array.from(new Set(failures.flatMap((failure) => failure.issuePaths)));
    throw new DipsApiError(
      `DIPS機体情報の全${arrayResult.data.length}件のエントリでパースに失敗しました (対象キー: ${failedKeys.join(", ")})`
    );
  }

  return entries.map(toAircraftInfo);
}
