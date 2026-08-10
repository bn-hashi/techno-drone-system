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
  1: "滅失・解体",
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

/** 機体ステータス: 1=有効(登録済)。dipsService の抽出条件・UI の選択可否判定・Badge の
 * 見た目判定はすべてこの定数を参照する (ステータスコード表が複数ファイルに散在していた
 * ことへの是正)。 */
export const DIPS_UA_STATUS_ACTIVE = 1;
/** 機体ステータス: 2=有効期限切れ */
export const DIPS_UA_STATUS_EXPIRED = 2;
/** 機体ステータス: 3=抹消済み */
export const DIPS_UA_STATUS_DEREGISTERED = 3;

/** コード表に定義がない値に遭遇したときの表示 (寛容パース方針。クライアント側は未知コードでも落ちない) */
const UNKNOWN_CODE_LABEL = "不明";

/**
 * 機体ステータスコードから表示ラベルを返す。DIPS 側が別紙1 未定義のコード値を返しても
 * 画面が壊れないよう、定義外の値は「不明」にフォールバックする。null (寛容パースで
 * 正規化できなかった値) も「不明」として扱う。
 */
export function dipsUaStatusLabel(status: number | null): string {
  if (status === null) return UNKNOWN_CODE_LABEL;
  return DIPS_UA_STATUS_LABELS[status as DipsUaStatus] ?? UNKNOWN_CODE_LABEL;
}

/** 抹消理由コードから表示ラベルを返す。未知の値は「不明」にフォールバックする */
export function dipsDeregistrationReasonLabel(reason: number): string {
  return DIPS_DEREGISTRATION_REASON_LABELS[reason as DipsDeregistrationReason] ?? UNKNOWN_CODE_LABEL;
}

export type DipsAircraftStatusBadgeVariant = "active" | "pending" | "danger";

/**
 * 機体ステータスに対応する Badge の見た目 (既存の active/pending/danger 語彙を流用)。
 * 別紙1 未定義のコード値・null (寛容パースで正規化できなかった値) は danger 側に
 * フォールバックする (取り込み対象として選ばせないための保守的な扱い)。
 * `DipsAircraftPickerModal.tsx` に個別実装されていたものをここへ集約した
 * (ステータスコード表が複数ファイルに散在していたことへの是正)。
 */
export function dipsUaStatusBadgeVariant(status: number | null): DipsAircraftStatusBadgeVariant {
  if (status === DIPS_UA_STATUS_ACTIVE) return "active";
  if (status === DIPS_UA_STATUS_EXPIRED) return "pending";
  return "danger";
}
