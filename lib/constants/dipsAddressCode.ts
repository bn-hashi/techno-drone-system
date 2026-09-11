/**
 * DIPS 別紙1 (国コードのデータ定義) ・別紙2 (都道府県コードのデータ定義)
 * 出典: `_orchestrator/results/quick/20260908-fpr-guideline-appendix-codes.txt`
 * (DIPS2.0_API（FPR）_Guideline.pdf 巻末、2026-09-08 取得)
 *
 * 本システムの利用者 (登録講習機関の受講者・教官) は国内在住が前提のため、国コードは
 * 日本の固定値のみを定義する (§1-1/§3 の設計判断。海外の国コードは199件あり、
 * 使われない値を保守する意味がないため YAGNI で見送る)。
 *
 * 都道府県は別紙2 の47件をそのまま定義する。別紙2 には「その他 = 99」という
 * 47都道府県以外向けの値も定義されているが、利用者が国内在住である前提と矛盾するため
 * 選択肢には含めない (不正なコード送信を防ぐため、DipsNotifyInputSchema はこの47件の
 * 集合でのみ検証する)。
 */

/** 別紙1 国コードのデータ定義: 日本 */
export const DIPS_COUNTRY_CODE_JAPAN = "001";

export const DIPS_PREFECTURE_OPTIONS: ReadonlyArray<{ code: string; label: string }> = [
  { code: "01", label: "北海道" },
  { code: "02", label: "青森県" },
  { code: "03", label: "岩手県" },
  { code: "04", label: "宮城県" },
  { code: "05", label: "秋田県" },
  { code: "06", label: "山形県" },
  { code: "07", label: "福島県" },
  { code: "08", label: "茨城県" },
  { code: "09", label: "栃木県" },
  { code: "10", label: "群馬県" },
  { code: "11", label: "埼玉県" },
  { code: "12", label: "千葉県" },
  { code: "13", label: "東京都" },
  { code: "14", label: "神奈川県" },
  { code: "15", label: "新潟県" },
  { code: "16", label: "富山県" },
  { code: "17", label: "石川県" },
  { code: "18", label: "福井県" },
  { code: "19", label: "山梨県" },
  { code: "20", label: "長野県" },
  { code: "21", label: "岐阜県" },
  { code: "22", label: "静岡県" },
  { code: "23", label: "愛知県" },
  { code: "24", label: "三重県" },
  { code: "25", label: "滋賀県" },
  { code: "26", label: "京都府" },
  { code: "27", label: "大阪府" },
  { code: "28", label: "兵庫県" },
  { code: "29", label: "奈良県" },
  { code: "30", label: "和歌山県" },
  { code: "31", label: "鳥取県" },
  { code: "32", label: "島根県" },
  { code: "33", label: "岡山県" },
  { code: "34", label: "広島県" },
  { code: "35", label: "山口県" },
  { code: "36", label: "徳島県" },
  { code: "37", label: "香川県" },
  { code: "38", label: "愛媛県" },
  { code: "39", label: "高知県" },
  { code: "40", label: "福岡県" },
  { code: "41", label: "佐賀県" },
  { code: "42", label: "長崎県" },
  { code: "43", label: "熊本県" },
  { code: "44", label: "大分県" },
  { code: "45", label: "宮崎県" },
  { code: "46", label: "鹿児島県" },
  { code: "47", label: "沖縄県" },
];

/** コード表に定義がない値に遭遇したときの表示 (dipsAircraftStatus.ts と同じ寛容パース方針) */
const UNKNOWN_CODE_LABEL = "不明";

/** 都道府県コードから表示ラベルを返す。未定義の値は「不明」にフォールバックする */
export function dipsPrefectureLabel(code: string): string {
  const found = DIPS_PREFECTURE_OPTIONS.find((option) => option.code === code);
  return found?.label ?? UNKNOWN_CODE_LABEL;
}

/** 都道府県コードが47件の定義済みコードのいずれかと一致するか (境界検証用) */
export function isKnownDipsPrefectureCode(code: string): boolean {
  return DIPS_PREFECTURE_OPTIONS.some((option) => option.code === code);
}
