/**
 * DIPS 飛行禁止エリア種別コード (DIPS2.0 API(FPR) ガイドライン v1.9 2.3.7)
 */

export const DIPS_FLIGHT_PROHIBITED_AREA_TYPE_OPTIONS: ReadonlyArray<{
  code: number;
  label: string;
}> = [
  { code: 1, label: "空港等の周辺空域" },
  { code: 2, label: "人口集中地区" },
  { code: 5, label: "小型無人機等飛行禁止法エリア(レッドゾーン)" },
  { code: 6, label: "小型無人機等飛行禁止法エリア(イエローゾーン)" },
  { code: 7, label: "条例等で定めるエリア" },
  { code: 8, label: "有人機離着陸エリア" },
  { code: 9, label: "緊急時用務空域" },
  { code: 10, label: "その他1" },
  { code: 11, label: "その他2" },
];
