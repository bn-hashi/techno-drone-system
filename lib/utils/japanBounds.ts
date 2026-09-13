/**
 * 座標が「おおむね日本国内」の矩形に収まっているかを判定する。
 *
 * 2026-09-07 の本番疎通確認で、飛行範囲の経度・緯度に `1, 1`
 * (南太平洋の赤道上) が誤入力され、そのまま送信された事故を受けて追加した
 * (req-012 段階1)。座標は数値入力欄が正であり続ける (地図はまだ導入しない) ため、
 * 明らかにおかしい値を「警告」として利用者に示すことが目的。送信は止めない
 * (DIPS が域外座標を受け付けるかどうかが未確認であり、ブロックすると正当な
 * 運用や疎通確認を誤って止める危険があるため。req-012 論点6-4)。
 *
 * 矩形は与那国島(西)・南鳥島(東)・沖ノ鳥島(南)・択捉島(北)の緯度経度に、
 * 各端で余裕を持たせて丸めた近似値。離島の実際の位置より広めに取ることで、
 * 正当な飛行を誤って警告しすぎないようにしている。
 */
export const JAPAN_LONGITUDE_MIN = 122.0; // 与那国島 (約122.93) より西側に余裕
export const JAPAN_LONGITUDE_MAX = 154.0; // 南鳥島 (約153.99) より東側に余裕
export const JAPAN_LATITUDE_MIN = 20.0; // 沖ノ鳥島 (約20.42) より南側に余裕
export const JAPAN_LATITUDE_MAX = 46.0; // 択捉島 (約45.55) より北側に余裕

/** 日本国外の座標に対して表示する警告文。経度・緯度の取り違えが最も多い誤りのため、その示唆を含める */
export const OUT_OF_JAPAN_WARNING_MESSAGE =
  "この座標は日本国内ではありません。経度・緯度が入れ替わっていないか確認してください";

/** 座標が「おおむね日本国内」の矩形に収まっているかを判定する */
export function isWithinJapanBounds(longitude: number, latitude: number): boolean {
  return (
    longitude >= JAPAN_LONGITUDE_MIN &&
    longitude <= JAPAN_LONGITUDE_MAX &&
    latitude >= JAPAN_LATITUDE_MIN &&
    latitude <= JAPAN_LATITUDE_MAX
  );
}
