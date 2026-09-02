import { z } from "zod";
import { DipsApiError } from "@/lib/dips/errors";
import type { DipsFlightProhibitedAreaInfo } from "@/lib/dips/types";
import {
  describeReceivedType,
  normalizeEntriesWithDiagnostics,
} from "@/lib/dips/normalizeEntriesWithDiagnostics";

/**
 * 飛行禁止エリア情報取得 API (DIPS2.0 API(FPR) 接続システム向けガイドライン v1.9 2.3.7) の
 * 生レスポンスを検証・正規化する境界。`lib/dips/permissionsSchema.ts` と同じ構造
 * (エントリ単位のフォールバック・ログ・全件失敗時の DipsApiError は
 * `lib/dips/normalizeEntriesWithDiagnostics.ts` の共通エンジンへ委譲する)。
 *
 * このレスポンスは地理情報・エリア種別・名称のみで個人情報を一切含まない
 * (5-1/5-2 のような PII 遮断のための寛容化・型からの除外は不要)。
 *
 * ジオメトリ (`range`) は Circle/Polygon いずれの場合も center/radius/coordinates の
 * 全キーが返る (該当しない側は空配列・0。ガイドラインのレスポンスボディサンプル参照)。
 */

const AreaGeometrySchema = z.object({
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

const ProhibitedAreaEntrySchema = z.object({
  flightProhibitedAreaId: z.string(),
  name: z.string(),
  range: AreaGeometrySchema,
  detail: z.string(),
  url: z.string(),
  flightProhibitedAreaTypeId: z.number(),
  startTime: z.string(),
  finishTime: z.string(),
});

type ProhibitedAreaEntry = z.infer<typeof ProhibitedAreaEntrySchema>;

/**
 * `flightProhibitedAreaInfo` の値そのもの (配列 または null) を検証するスキーマ。
 * キーの存在確認は `extractProhibitedAreaArray` が別途行う (permissionsSchema.ts の
 * `PermissionsValueSchema` と同じ考え方)。
 */
const ProhibitedAreaListValueSchema = z.array(z.unknown()).nullable();

export interface NormalizeFlightProhibitedAreasResult {
  areas: DipsFlightProhibitedAreaInfo[];
  /** パースに失敗して除外したエリアの件数 */
  excludedCount: number;
}

function toAreaInfo(entry: ProhibitedAreaEntry): DipsFlightProhibitedAreaInfo {
  return {
    areaId: entry.flightProhibitedAreaId,
    name: entry.name,
    detail: entry.detail,
    url: entry.url,
    areaTypeId: entry.flightProhibitedAreaTypeId,
    startTime: entry.startTime,
    finishTime: entry.finishTime,
    range: entry.range,
  };
}

/**
 * 生レスポンスから `flightProhibitedAreaInfo` 配列を取り出す。`permissionsSchema.ts` の
 * `extractPermissionsArray` (F1 差し戻し) と同じ方針で、キー自体が無い場合と明示的な
 * null を区別する:
 * - キー自体が存在しない → 仕様変更・接続先誤りの疑いとして DipsApiError
 * - 明示的に `null` または `[]` → 「該当エリアなし」の正当な空状態として空配列を返す
 * - 上記以外の不正な値 → DipsApiError
 */
function extractProhibitedAreaArray(raw: unknown): unknown[] {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    throw new DipsApiError(
      `DIPS飛行禁止エリア情報のレスポンス形式が不正です (受信した型: ${describeReceivedType(raw)})`
    );
  }

  if (!Object.prototype.hasOwnProperty.call(raw, "flightProhibitedAreaInfo")) {
    throw new DipsApiError(
      "DIPS飛行禁止エリア情報のレスポンスに flightProhibitedAreaInfo キーが存在しません (仕様変更またはDIPS接続先の誤りの疑いがあります)"
    );
  }

  const rawValue = (raw as Record<string, unknown>).flightProhibitedAreaInfo;
  const shapeResult = ProhibitedAreaListValueSchema.safeParse(rawValue);
  if (!shapeResult.success) {
    throw new DipsApiError(
      `DIPS飛行禁止エリア情報のレスポンス形式が不正です (flightProhibitedAreaInfo の値が不正です。受信した型: ${describeReceivedType(rawValue)})`
    );
  }

  return shapeResult.data ?? [];
}

/**
 * 飛行禁止エリア情報取得 API の生レスポンスを検証し、DipsFlightProhibitedAreaInfo[] へ
 * 正規化する。除外したエリアの件数も併せて返す (`excludedCount`)。
 */
export function normalizeFlightProhibitedAreasWithDiagnostics(
  raw: unknown
): NormalizeFlightProhibitedAreasResult {
  const { entries, excludedCount } = normalizeEntriesWithDiagnostics(raw, {
    entrySchema: ProhibitedAreaEntrySchema,
    extractArray: extractProhibitedAreaArray,
    subject: "DIPS飛行禁止エリア情報",
    route: "normalizeFlightProhibitedAreas",
  });

  return { areas: entries.map(toAreaInfo), excludedCount };
}
