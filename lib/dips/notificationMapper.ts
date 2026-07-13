/**
 * FlightPlan → DIPS 飛行計画通報ペイロードへのマッピング補助
 */

const JST_OFFSET_MINUTES = 9 * 60;

/** FPRガイドライン 2.3.8: plannedMaxTime / plannedFlightTime は 5分単位・5〜1440分 */
const DIPS_MINUTES_STEP = 5;
const DIPS_MINUTES_MIN = 5;
const DIPS_MINUTES_MAX = 1440;

/**
 * 分数を DIPS の制約 (5分単位・5〜1440) に収める。
 * 端数は安全側 (切り上げ) に丸める。例: 7分 → 10分、1500分 → 1440分。
 */
export function clampToDipsFlightMinutes(minutes: number): number {
  const roundedUp = Math.ceil(minutes / DIPS_MINUTES_STEP) * DIPS_MINUTES_STEP;
  return Math.min(Math.max(roundedUp, DIPS_MINUTES_MIN), DIPS_MINUTES_MAX);
}

/**
 * 飛行開始日時を DIPS 形式 "yyyyMMdd hhmm" (JST, 半角スペース区切り) に整形する。
 * DB の DateTime は UTC 基準のため JST に変換してから整形する。
 */
export function formatDipsStartTime(date: Date): string {
  const jst = new Date(date.getTime() + JST_OFFSET_MINUTES * 60_000);
  const yyyy = jst.getUTCFullYear();
  const mm = String(jst.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(jst.getUTCDate()).padStart(2, "0");
  const hh = String(jst.getUTCHours()).padStart(2, "0");
  const min = String(jst.getUTCMinutes()).padStart(2, "0");
  return `${yyyy}${mm}${dd} ${hh}${min}`;
}

/**
 * 中心点 (経度・緯度) と半径から Circle 型の flyRoute GeoJSON 文字列を生成する。
 * FPRガイドライン 2.3.8 のサンプルに準拠。
 */
export function buildCircleFlyRoute(
  longitude: number,
  latitude: number,
  radiusMeters: number
): string {
  return JSON.stringify({
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        properties: { radius: radiusMeters },
        geometry: { type: "Circle", center: [longitude, latitude] },
      },
    ],
  });
}
