const DEFAULT_PAGE = 1;

/** URL の `?page=` 文字列を正の整数に変換する。0/負数/小数/非数値は全て1にフォールバックする */
export function parsePageParam(rawPage: string | undefined): number {
  const parsed = Number(rawPage ?? DEFAULT_PAGE);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : DEFAULT_PAGE;
}
