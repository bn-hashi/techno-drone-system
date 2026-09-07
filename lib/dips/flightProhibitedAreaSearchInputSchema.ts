import { z } from "zod";
import { DIPS_FLIGHT_PROHIBITED_AREA_TYPE_OPTIONS } from "@/lib/constants/dipsFlightProhibitedAreaType";

/**
 * 飛行禁止エリア情報取得 API (5-5) の検索フォーム入力検証。
 * ガイドライン 2.3.7 は検索範囲 (features) と飛行禁止エリア種別 (1件以上) を必須とする。
 * 本システムは Circle (中心点+半径) のみをサポートする (`DipsCircleSearchFeature` 参照)。
 */

/**
 * 飛行禁止エリア種別コードの妥当性は `DIPS_FLIGHT_PROHIBITED_AREA_TYPE_OPTIONS`
 * (lib/constants/dipsFlightProhibitedAreaType.ts) から導出する。以前は
 * `z.number().int().min(1).max(11)` という範囲チェックのみで、ガイドラインで欠番の
 * 種別コード 3・4 もそのまま DIPS へ転送されていた (2026-09-06 レビュー I9)。定数と
 * バリデーションをここへ集約し、種別コードが増減しても1箇所の変更で済むようにする。
 */
const VALID_AREA_TYPE_CODES = DIPS_FLIGHT_PROHIBITED_AREA_TYPE_OPTIONS.map((option) => option.code);

const AreaTypeCodeSchema = z.union(
  VALID_AREA_TYPE_CODES.map((code) => z.literal(code)) as [
    z.ZodLiteral<number>,
    z.ZodLiteral<number>,
    ...z.ZodLiteral<number>[],
  ]
);

export const DipsFlightProhibitedAreaSearchInputSchema = z.object({
  centerLongitude: z.number().min(-180).max(180),
  centerLatitude: z.number().min(-90).max(90),
  radiusMeters: z.number().positive(),
  flightProhibitedAreaTypeIds: z
    .array(AreaTypeCodeSchema)
    .min(1)
    // 同じ種別コードの重複指定 (例: [5, 5, 5]) をそのまま DIPS へ転送しない
    .refine((ids) => new Set(ids).size === ids.length, {
      message: "飛行禁止エリア種別が重複しています",
    }),
});

export type DipsFlightProhibitedAreaSearchInput = z.infer<
  typeof DipsFlightProhibitedAreaSearchInputSchema
>;
