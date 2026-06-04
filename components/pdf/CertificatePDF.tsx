import { Document, Page, View, Text, StyleSheet } from "@react-pdf/renderer";
import {
  CERTIFICATE_TITLE,
  CERTIFICATE_FORM_LABEL,
  CERTIFICATE_FORM_NUMBER,
  CERTIFICATE_LEGAL_STATEMENT,
} from "@/lib/constants";

export interface CertificatePDFProps {
  certificateNumber: string;
  studentName: string;
  applicantNumber: string;
  examinerName: string;
  issuedAt: Date;
  expiresAt: Date;
  institutionName: string;
  institutionCode: string;
  schoolName: string;
  trainingOfficeCode: string;
}

/**
 * 修了証明書 様式1 (D検様式 240302-01) のレイアウト。
 *
 * 国土交通省「無人航空機講習修了証明書 様式1」を忠実に再現する。
 * フォントは pdfGenerator 側で Font.register 済みの "NotoSansJP" を使用する。
 *
 * 本スクールが交付する技能区分は「二等・回転翼航空機(マルチローター)・基本」固定のため、
 * 区分表の該当マーク (●) はその位置に固定で描画する。
 * 取り扱い区分が増えた場合は props 化を検討する。
 */

// --- 区分表のレイアウト寸法 (A4 用紙幅 595pt / 左右余白 48pt → 利用可能幅 約499pt 内に収める) ---
/** 「区分」列の幅 */
const KUBUN_COLUMN_WIDTH = 32;
/** 限定解除事項の小列 (基本/25kg/昼間/目視内) 1 列分の幅 */
const QUALIFICATION_CELL_WIDTH = 38.4;
/** 機体種別 1 グループ (小列 4 つ) の幅 */
const MACHINE_GROUP_WIDTH = QUALIFICATION_CELL_WIDTH * 4;
/** 限定解除事項エリア全体 (機体種別 3 グループ) の幅 */
const LIMITED_AREA_WIDTH = MACHINE_GROUP_WIDTH * 3;

/** ヘッダー1段目「限定解除事項」の高さ */
const HEADER_TITLE_HEIGHT = 20;
/** ヘッダー2段目「機体種別名」の高さ */
const HEADER_MACHINE_HEIGHT = 30;
/** ヘッダー3段目 (小列の区切り) の高さ */
const HEADER_DIVIDER_HEIGHT = 12;
/** 「区分」列ヘッダーセルの高さ (ヘッダー3段分を縦結合) */
const HEADER_TOTAL_HEIGHT = HEADER_TITLE_HEIGHT + HEADER_MACHINE_HEIGHT + HEADER_DIVIDER_HEIGHT;
/** 等級行 (一等 / 二等) の高さ */
const GRADE_ROW_HEIGHT = 50;
/** 該当マーク (●) 行の高さ */
const MARK_ROW_HEIGHT = 18;

/** 罫線色 */
const BORDER_COLOR = "#000000";

/** 限定解除事項の小列ラベル (左から順) */
const QUALIFICATION_LABELS = ["基本", "２５ｋｇ", "昼間", "目視内"] as const;

/** 機体種別ラベル (左から順)。回転翼は 2 行表記。 */
const MACHINE_TYPE_LABELS = [
  "回転翼航空機\n（マルチローター）",
  "回転翼航空機\n（ヘリコプター）",
  "飛行機",
] as const;

const styles = StyleSheet.create({
  page: {
    fontFamily: "NotoSansJP",
    paddingHorizontal: 48,
    paddingTop: 45,
    paddingBottom: 45,
    fontSize: 10,
    color: "#000000",
  },
  formLabel: {
    fontSize: 9,
  },
  title: {
    fontSize: 18,
    textAlign: "center",
    marginTop: 6,
    marginBottom: 14,
    letterSpacing: 2,
  },
  headerRightBlock: {
    alignItems: "flex-end",
    marginBottom: 18,
  },
  headerRightLine: {
    fontSize: 11,
    marginBottom: 4,
  },
  studentName: {
    fontSize: 13,
    marginLeft: 24,
    marginBottom: 8,
  },
  applicantNumber: {
    fontSize: 10,
    marginLeft: 16,
    marginBottom: 16,
  },
  legalStatement: {
    fontSize: 10,
    lineHeight: 1.7,
    marginBottom: 20,
    textIndent: 10,
  },
  // --- 区分表 ---
  table: {
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderColor: BORDER_COLOR,
  },
  row: {
    flexDirection: "row",
  },
  column: {
    flexDirection: "column",
  },
  cell: {
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: BORDER_COLOR,
    alignItems: "center",
    justifyContent: "center",
  },
  cellText: {
    fontSize: 9,
    textAlign: "center",
  },
  machineText: {
    fontSize: 9,
    textAlign: "center",
    lineHeight: 1.3,
  },
  verticalChar: {
    fontSize: 9,
    lineHeight: 1.2,
    textAlign: "center",
  },
  kubunChar: {
    fontSize: 11,
    lineHeight: 1.25,
    textAlign: "center",
  },
  markText: {
    fontSize: 11,
    textAlign: "center",
  },
  // --- フッター ---
  footer: {
    marginTop: 28,
    fontSize: 10,
  },
  examiner: {
    marginBottom: 10,
  },
  institutionBlock: {
    marginLeft: 24,
    lineHeight: 1.7,
  },
  institutionName: {
    fontSize: 12,
  },
  formNumber: {
    position: "absolute",
    bottom: 28,
    right: 48,
    fontSize: 9,
  },
});

/** StyleSheet.create が返す各エントリの style 型 (react-pdf の Style と互換) */
type TextStyle = (typeof styles)[keyof typeof styles];

/** 文字列を 1 文字ずつ縦に積んで描画する (区分・等級・限定解除事項ラベル用) */
function VerticalText({ text, style }: { text: string; style: TextStyle }) {
  return (
    <View>
      {Array.from(text).map((char, index) => (
        <Text key={`${char}-${index}`} style={style}>
          {char}
        </Text>
      ))}
    </View>
  );
}

/** 修了日・有効期限の表記用に JST で YYYY年MM月DD日 (ゼロ埋め) を生成する */
function formatJstDate(date: Date): string {
  const parts = new Intl.DateTimeFormat("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "Asia/Tokyo",
  }).formatToParts(date);
  const find = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";
  return `${find("year")}年${find("month")}月${find("day")}日`;
}

/** 限定解除事項の小列ラベルを描画する 4 セル (1 機体グループ分) */
function QualificationCells({ rowHeight }: { rowHeight: number }) {
  return (
    <>
      {QUALIFICATION_LABELS.map((label) => (
        <View
          key={label}
          style={[styles.cell, { width: QUALIFICATION_CELL_WIDTH, height: rowHeight }]}
        >
          <VerticalText text={label} style={styles.verticalChar} />
        </View>
      ))}
    </>
  );
}

/** 等級行 (一等 / 二等): 区分セル + 機体種別 3 グループ分の小列ラベル */
function GradeRow({ grade }: { grade: string }) {
  return (
    <View style={styles.row}>
      <View style={[styles.cell, { width: KUBUN_COLUMN_WIDTH, height: GRADE_ROW_HEIGHT }]}>
        <VerticalText text={grade} style={styles.kubunChar} />
      </View>
      {MACHINE_TYPE_LABELS.map((machine) => (
        <QualificationCells key={machine} rowHeight={GRADE_ROW_HEIGHT} />
      ))}
    </View>
  );
}

export function CertificatePDF(props: CertificatePDFProps) {
  const {
    certificateNumber,
    studentName,
    applicantNumber,
    examinerName,
    issuedAt,
    expiresAt,
    institutionName,
    institutionCode,
    schoolName,
    trainingOfficeCode,
  } = props;

  // 該当マーク行: 区分列と「回転翼マルチ・基本」(小列 0) に ● を置き、残りは空欄
  const markCellIndexes = Array.from({ length: 12 }, (_, index) => index);

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.formLabel}>{CERTIFICATE_FORM_LABEL}</Text>
        <Text style={styles.title}>{CERTIFICATE_TITLE}</Text>

        <View style={styles.headerRightBlock}>
          <Text style={styles.headerRightLine}>{certificateNumber}</Text>
          <Text style={styles.headerRightLine}>{formatJstDate(issuedAt)}修了</Text>
          <Text style={styles.headerRightLine}>{formatJstDate(expiresAt)}まで有効</Text>
        </View>

        <Text style={styles.studentName}>{studentName}　殿</Text>
        <Text style={styles.applicantNumber}>技能証明申請者番号：{applicantNumber}</Text>

        <Text style={styles.legalStatement}>{CERTIFICATE_LEGAL_STATEMENT}</Text>

        {/* 区分表 */}
        <View style={styles.table}>
          {/* ヘッダー: 区分 (縦結合) + 限定解除事項エリア */}
          <View style={styles.row}>
            <View style={[styles.cell, { width: KUBUN_COLUMN_WIDTH, height: HEADER_TOTAL_HEIGHT }]}>
              <VerticalText text="区分" style={styles.kubunChar} />
            </View>
            <View style={styles.column}>
              <View
                style={[styles.cell, { width: LIMITED_AREA_WIDTH, height: HEADER_TITLE_HEIGHT }]}
              >
                <Text style={styles.cellText}>限定解除事項</Text>
              </View>
              <View style={styles.row}>
                {MACHINE_TYPE_LABELS.map((machine) => (
                  <View
                    key={machine}
                    style={[
                      styles.cell,
                      { width: MACHINE_GROUP_WIDTH, height: HEADER_MACHINE_HEIGHT },
                    ]}
                  >
                    <Text style={styles.machineText}>{machine}</Text>
                  </View>
                ))}
              </View>
              <View style={styles.row}>
                {markCellIndexes.map((index) => (
                  <View
                    key={index}
                    style={[
                      styles.cell,
                      { width: QUALIFICATION_CELL_WIDTH, height: HEADER_DIVIDER_HEIGHT },
                    ]}
                  />
                ))}
              </View>
            </View>
          </View>

          {/* 一等 */}
          <GradeRow grade="一等" />

          {/* 該当マーク行 */}
          <View style={styles.row}>
            <View style={[styles.cell, { width: KUBUN_COLUMN_WIDTH, height: MARK_ROW_HEIGHT }]}>
              <Text style={styles.markText}>●</Text>
            </View>
            {markCellIndexes.map((index) => (
              <View
                key={index}
                style={[styles.cell, { width: QUALIFICATION_CELL_WIDTH, height: MARK_ROW_HEIGHT }]}
              >
                {index === 0 ? <Text style={styles.markText}>●</Text> : null}
              </View>
            ))}
          </View>

          {/* 二等 */}
          <GradeRow grade="二等" />
        </View>

        {/* フッター */}
        <View style={styles.footer}>
          <Text style={styles.examiner}>修了審査員：{examinerName}</Text>
          <View style={styles.institutionBlock}>
            <Text>登録講習機関名</Text>
            <Text style={styles.institutionName}>{institutionName}</Text>
            <Text>{schoolName}</Text>
            <Text>登録講習機関コード：{institutionCode}</Text>
            <Text>講習事務所コード：{trainingOfficeCode}</Text>
          </View>
        </View>

        <Text style={styles.formNumber}>{CERTIFICATE_FORM_NUMBER}</Text>
      </Page>
    </Document>
  );
}
