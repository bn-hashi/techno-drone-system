import { z } from "zod";
import type { DipsFlightProhibitedAreaInfo } from "@/lib/dips/types";
import { normalizeEntriesWithDiagnostics } from "@/lib/dips/normalizeEntriesWithDiagnostics";
import { DipsGeometrySchema } from "@/lib/dips/geometrySchema";

/**
 * 飛行禁止エリア情報取得 API (DIPS2.0 API(FPR) 接続システム向けガイドライン v1.9 2.3.7) の
 * 生レスポンスを検証・正規化する境界。`lib/dips/permissionsSchema.ts` と同じ構造
 * (エントリ単位のフォールバック・ログ・全件失敗時の DipsApiError は
 * `lib/dips/normalizeEntriesWithDiagnostics.ts` の共通エンジンへ委譲する)。
 *
 * このレスポンスは地理情報・エリア種別・名称のみで個人情報を一切含まない
 * (5-1/5-2 のような PII 遮断のための寛容化・型からの除外は不要)。
 *
 * ジオメトリ (`range`) のスキーマは `flightPlanSchema.ts` の `flyRoute` とバイト単位で
 * 同一だったため (2026-09-06 レビュー I5)、`lib/dips/geometrySchema.ts` の
 * `DipsGeometrySchema` へ1本化した。
 */

const ProhibitedAreaEntrySchema = z.object({
  flightProhibitedAreaId: z.string(),
  name: z.string(),
  range: DipsGeometrySchema,
  detail: z.string(),
  url: z.string(),
  flightProhibitedAreaTypeId: z.number(),
  startTime: z.string(),
  finishTime: z.string(),
});

type ProhibitedAreaEntry = z.infer<typeof ProhibitedAreaEntrySchema>;

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
 * 飛行禁止エリア情報取得 API の生レスポンスを検証し、DipsFlightProhibitedAreaInfo[] へ
 * 正規化する。除外したエリアの件数も併せて返す (`excludedCount`)。生レスポンスから
 * `flightProhibitedAreaInfo` 配列を取り出す処理 (キー欠落と明示的な null の区別。F1
 * 差し戻しの方針) は、`permissionsSchema.ts`/`flightPlanSchema.ts` と重複していたため、
 * 共通エンジンの `arrayKey` オプションへ委譲する (2026-09-06 レビュー I6)。
 */
export function normalizeFlightProhibitedAreasWithDiagnostics(
  raw: unknown
): NormalizeFlightProhibitedAreasResult {
  const { entries, excludedCount } = normalizeEntriesWithDiagnostics(raw, {
    entrySchema: ProhibitedAreaEntrySchema,
    arrayKey: "flightProhibitedAreaInfo",
    subject: "DIPS飛行禁止エリア情報",
    route: "normalizeFlightProhibitedAreas",
  });

  return { areas: entries.map(toAreaInfo), excludedCount };
}
