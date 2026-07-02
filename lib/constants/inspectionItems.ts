/** 飛行前後点検のチェック項目 (国交省の日常点検項目を簡略化した6項目) */
export const INSPECTION_ITEMS = [
  { key: "battery", label: "バッテリー残量・外観" },
  { key: "propeller", label: "プロペラ取付・損傷" },
  { key: "gps", label: "GPS 受信確認" },
  { key: "motor", label: "モーター異音確認" },
  { key: "camera", label: "カメラ・ジンバル動作" },
  { key: "controller", label: "送信機電源・通信確認" },
] as const;

export type InspectionItemKey = (typeof INSPECTION_ITEMS)[number]["key"];

export const INSPECTION_ITEM_KEYS = INSPECTION_ITEMS.map((item) => item.key) as [
  InspectionItemKey,
  ...InspectionItemKey[],
];

export const INSPECTION_ITEM_LABELS: Record<InspectionItemKey, string> = Object.fromEntries(
  INSPECTION_ITEMS.map((item) => [item.key, item.label])
) as Record<InspectionItemKey, string>;

export const INSPECTION_RESULT_LABELS = {
  PASS: "良",
  FAIL: "不良",
  NA: "対象外",
} as const;

export const INSPECTION_PHASE_LABELS = {
  PRE_FLIGHT: "飛行前点検",
  POST_FLIGHT: "飛行後点検",
} as const;
