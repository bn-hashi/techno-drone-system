import { z } from "zod";

/**
 * 飛行禁止エリア情報取得 API (5-5) の検索フォーム入力検証。
 * ガイドライン 2.3.7 は検索範囲 (features) と飛行禁止エリア種別 (1件以上) を必須とする。
 * 本システムは Circle (中心点+半径) のみをサポートする (`DipsCircleSearchFeature` 参照)。
 */

/** 飛行禁止エリア種別コードの上限 (ガイドライン 2.3.7 は 1〜11 を定義) */
const MAX_AREA_TYPE_CODE = 11;

export const DipsFlightProhibitedAreaSearchInputSchema = z.object({
  centerLongitude: z.number().min(-180).max(180),
  centerLatitude: z.number().min(-90).max(90),
  radiusMeters: z.number().positive(),
  flightProhibitedAreaTypeIds: z.array(z.number().int().min(1).max(MAX_AREA_TYPE_CODE)).min(1),
});

export type DipsFlightProhibitedAreaSearchInput = z.infer<
  typeof DipsFlightProhibitedAreaSearchInputSchema
>;
