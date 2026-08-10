/**
 * DIPS 機体情報一覧取得 API (DRS API ガイドライン §2.3.6) のコード値表示ラベル。
 * 出典: 設定通知書 (R08-DRS-0005) 別紙1「機体情報一覧取得API_利用可能情報」
 */
import type {
  DipsUaStatus,
  DipsDeregistrationReason,
  DipsRemoteIdType,
} from "@/lib/dips/types";

export const DIPS_UA_STATUS_LABELS: Record<DipsUaStatus, string> = {
  1: "有効",
  2: "有効期限切れ",
  3: "抹消済み",
};

export const DIPS_DEREGISTRATION_REASON_LABELS: Record<DipsDeregistrationReason, string> = {
  1: "減失・解体",
  2: "存否が二箇月不明",
  3: "無人航空機でなくなった",
  4: "売却・譲渡",
  5: "その他",
  6: "登録の取消し",
  7: "更新登録が行われなかった",
};

export const DIPS_REMOTE_ID_TYPE_LABELS: Record<DipsRemoteIdType, string> = {
  0: "なし",
  1: "あり (内蔵型)",
  2: "あり (外付型)",
};
