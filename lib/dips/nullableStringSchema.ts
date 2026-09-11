import { z } from "zod";

/**
 * 空文字・null・キー欠落を null に正規化する共通スキーマ。
 *
 * `permissionsSchema.ts` の `permissionNumber2` と `flightProhibitedAreaSchema.ts` の
 * `detail`/`url` で、バイト単位で同一の定義が複製されていた (2026-09-11 コードレビュー
 * 指摘)。ジオメトリスキーマ (`geometrySchema.ts`) と同じ要領で共通モジュールへ1本化する。
 */
export const nullableString = z
  .string()
  .nullish()
  .transform((value) => (value === null || value === undefined || value === "" ? null : value));
