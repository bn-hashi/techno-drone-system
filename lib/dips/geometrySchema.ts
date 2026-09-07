import { z } from "zod";

/**
 * DIPS ジオメトリ (Circle/Polygon 共用のワイヤーフォーマット) の生レスポンスを検証・
 * 正規化する共通スキーマ。
 *
 * 飛行禁止エリア情報取得 (`range`) と飛行計画情報取得 (`flyRoute`) は、どちらも同じ
 * `DipsAreaGeometry` 型 (lib/dips/types.ts) を使うにもかかわらず、バイト単位で同一の
 * スキーマが `flightProhibitedAreaSchema.ts` と `flightPlanSchema.ts` に複製されていた
 * (2026-09-06 レビュー I5)。ここへ1本化する。
 *
 * Circle/Polygon いずれの場合も center/radius/coordinates の全キーが返る想定だが
 * (該当しない側は空配列・0。ガイドラインのレスポンスボディサンプル参照)、念のため
 * 欠損値も許容し既定値へフォールバックする。
 */
export const DipsGeometrySchema = z.object({
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
