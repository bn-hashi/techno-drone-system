import { z } from "zod";

/**
 * 飛行計画情報取得 API (5-4) の検索フォーム入力検証。
 * ガイドライン 2.3.6 は検索範囲 (features) のみ必須。`allFlightPlan` (自分の飛行計画の
 * みか全ユーザーか) は省略可能 (省略時は全ユーザー)。本システムは Circle
 * (中心点+半径) のみをサポートする (`DipsCircleSearchFeature` 参照)。
 */
export const DipsFlightPlanSearchInputSchema = z.object({
  centerLongitude: z.number().min(-180).max(180),
  centerLatitude: z.number().min(-90).max(90),
  radiusMeters: z.number().positive(),
  /** true: 自アカウントの飛行計画のみ, false/省略: 全ユーザー */
  onlyMine: z.boolean().optional(),
});

export type DipsFlightPlanSearchInput = z.infer<typeof DipsFlightPlanSearchInputSchema>;
