/**
 * DIPS 飛行空域種別コード (FPRガイドライン v1.9 2.3.8 No.7 flightAirspace)
 * 出典: `_orchestrator/results/quick/20260908-fpr-guideline-2.3.8-extract.txt`
 *
 * No.7 は必須ではなく任意 (－)。特定飛行の飛行形態のうち「空域」に関するものだけを表し、
 * いずれにも該当しない通常の飛行は空配列が正しい値 (req-013 差し戻し J2)。
 * ここに挙げる3つのいずれかに該当する飛行は「許可・承認を要する特定飛行」であり、
 * このシステムの通報ダイアログは許可・承認情報 (No.74 flightPermitApplicationInfo) を
 * 送らないため、そのような飛行はこの画面から通報できない
 * (`docs/dips-integration.md` の「未実装のまま残っているもの」参照)。
 */
export const DIPS_FLIGHT_AIRSPACE_OPTIONS: ReadonlyArray<{
  code: number;
  label: string;
}> = [
  { code: 1, label: "人・家屋の密集地域 (DID) の上空を飛行する" },
  { code: 2, label: "地表・水面から150m以上の高さを飛行する" },
  { code: 3, label: "空港周辺を飛行する" },
];
