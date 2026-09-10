/**
 * DIPS 機体の種類コード (FPRガイドライン v1.9 2.3.8 No.66)
 * 出典: `_orchestrator/results/quick/20260908-fpr-guideline-2.3.8-extract.txt`
 */
import type { DipsUaType } from "@/lib/dips/types";

export const DIPS_AIRCRAFT_TYPE_OPTIONS: ReadonlyArray<{
  code: DipsUaType;
  label: string;
}> = [
  { code: 1, label: "飛行機" },
  { code: 2, label: "回転翼航空機（ヘリコプター）" },
  { code: 3, label: "回転翼航空機（マルチローター）" },
  { code: 4, label: "回転翼航空機（その他）" },
  { code: 5, label: "滑空機" },
  { code: 6, label: "飛行船" },
];

/** コード表に定義がない値に遭遇したときの表示 (dipsAircraftStatus.ts と同じ寛容パース方針) */
const UNKNOWN_CODE_LABEL = "不明";

/**
 * 機体の種類コードから表示ラベルを返す。未定義の値・null (未設定) は
 * 「不明」にフォールバックする。
 */
export function dipsUaTypeLabel(code: number | null): string {
  if (code === null) return UNKNOWN_CODE_LABEL;
  const found = DIPS_AIRCRAFT_TYPE_OPTIONS.find((option) => option.code === code);
  return found?.label ?? UNKNOWN_CODE_LABEL;
}
