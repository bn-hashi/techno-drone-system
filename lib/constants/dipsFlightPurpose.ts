/**
 * DIPS 飛行目的コード (FPRガイドライン v1.9 2.3.8)
 */
import type { DipsFlightPurposeCode } from "@/lib/dips/types";

export const DIPS_FLIGHT_PURPOSE_OPTIONS: ReadonlyArray<{
  code: DipsFlightPurposeCode;
  label: string;
}> = [
  { code: 1, label: "空撮" },
  { code: 2, label: "報道取材" },
  { code: 3, label: "警備" },
  { code: 4, label: "農林水産業" },
  { code: 5, label: "測量" },
  { code: 6, label: "環境調査" },
  { code: 7, label: "設備メンテナンス" },
  { code: 8, label: "インフラ点検・保守" },
  { code: 9, label: "資材管理" },
  { code: 10, label: "輸送・宅配" },
  { code: 11, label: "自然観測" },
  { code: 12, label: "事故・災害対応等" },
  { code: 13, label: "その他1 (業務)" },
  { code: 14, label: "趣味" },
  { code: 15, label: "研究開発" },
  { code: 16, label: "その他2 (業務以外)" },
];
