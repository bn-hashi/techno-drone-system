const MS_PER_MINUTE = 60 * 1000;

/**
 * 飛行時間 (分) を算出する。
 *
 * 端数の秒は 1 分に切り上げる (30秒の飛行も日誌上は 1 分として記録する)。
 * end が start 以前の場合は 0 を返す。
 */
export function calcDurationMin(start: Date, end: Date): number {
  const elapsedMs = end.getTime() - start.getTime();
  if (elapsedMs <= 0) return 0;

  return Math.ceil(elapsedMs / MS_PER_MINUTE);
}
