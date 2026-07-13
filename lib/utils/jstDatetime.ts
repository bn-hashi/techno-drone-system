const JST_OFFSET = "+09:00";
const JST_OFFSET_MS = 9 * 60 * 60 * 1000;

/** datetime-local の入力値 ("YYYY-MM-DDTHH:mm") を JST として解釈し ISO 8601 UTC 文字列に変換する */
export function toJstIso(datetimeLocalValue: string): string {
  return new Date(`${datetimeLocalValue}:00${JST_OFFSET}`).toISOString();
}

/** ISO 8601 UTC 文字列を JST の datetime-local 表記 ("YYYY-MM-DDTHH:mm") に変換する */
export function toJstDatetimeLocal(isoUtcValue: string): string {
  return new Date(new Date(isoUtcValue).getTime() + JST_OFFSET_MS).toISOString().slice(0, 16);
}

/** 現在時刻を JST の datetime-local 表記 ("YYYY-MM-DDTHH:mm") で返す */
export function getJstNowAsDatetimeLocal(): string {
  return new Date(Date.now() + JST_OFFSET_MS).toISOString().slice(0, 16);
}
