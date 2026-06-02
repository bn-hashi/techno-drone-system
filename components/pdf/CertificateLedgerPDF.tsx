import { Document, Page, View, Text, StyleSheet } from "@react-pdf/renderer";
import {
  CERTIFICATE_LEDGER_TITLE,
  CERTIFICATE_LEDGER_FORM_LABEL,
  CERTIFICATE_LEDGER_FORM_NUMBER,
} from "@/lib/constants";

export interface CertificateLedgerPDFProps {
  certificateNumber: string;
  studentName: string;
  applicantNumber: string;
  issuedAt: Date;
  expiresAt: Date;
}

/**
 * 修了証明書交付台帳 様式5 (D検様式 221201-01) のレイアウト。
 *
 * 登録講習機関が保管する台帳。1 件の発行済み証明書につき 1 エントリを描画する。
 * 本スクールの交付区分は「二等・回転翼航空機(マルチ)」固定のため、区分欄はその表記で固定する。
 * フォントは ledgerPdfGenerator 側で Font.register 済みの "NotoSansJP" を使用する。
 */

// --- レイアウト寸法 (A4 用紙幅 595pt / 左右余白 48pt → 利用可能幅 約499pt 内に収める) ---
/** 「契印（割印）」列の幅 */
const SEAL_COLUMN_WIDTH = 170;
/** 「修了証明番号」側 (右側) エリアの幅 */
const RIGHT_COLUMN_WIDTH = 325;
/** 右側を 2 分割した 1 セルの幅 (氏名/申請者番号・修了日/有効期限) */
const RIGHT_HALF_WIDTH = RIGHT_COLUMN_WIDTH / 2;
/** 右側を 4 分割した 1 セルの幅 (区分・限定欄) */
const RIGHT_QUARTER_WIDTH = RIGHT_COLUMN_WIDTH / 4;
/** 証明番号セルの幅 (右端に小欄を残す) */
const NUMBER_CELL_WIDTH = RIGHT_COLUMN_WIDTH - 60;
/** 証明番号行 右端の小欄の幅 */
const NUMBER_TRAILING_WIDTH = 60;

/** ヘッダー行の高さ */
const HEADER_ROW_HEIGHT = 26;
/** 本体 1 行の高さ */
const BODY_ROW_HEIGHT = 24;
/** 右側の本体行数 (契印セルの縦結合高さ計算用) */
const RIGHT_BODY_ROW_COUNT = 7;

/** 罫線色 */
const BORDER_COLOR = "#000000";
/** ヘッダーセルの地色 */
const HEADER_FILL = "#d9d9d9";

/** 本スクールの交付区分 (固定) */
const MACHINE_CATEGORY_LABEL = "回転翼航空機（マルチ）";
const GRADE_LABEL = "二等";
/** 限定欄の非該当表記 */
const NOT_APPLICABLE = "−";

const styles = StyleSheet.create({
  page: {
    fontFamily: "NotoSansJP",
    paddingHorizontal: 48,
    paddingTop: 45,
    paddingBottom: 45,
    fontSize: 10,
    color: "#000000",
  },
  formLabelWrap: {
    alignItems: "flex-end",
    marginBottom: 18,
  },
  formLabel: {
    borderWidth: 1,
    borderColor: BORDER_COLOR,
    paddingVertical: 3,
    paddingHorizontal: 10,
    fontSize: 10,
  },
  title: {
    fontSize: 14,
    marginBottom: 16,
  },
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
    paddingHorizontal: 4,
  },
  headerCell: {
    backgroundColor: HEADER_FILL,
  },
  headerText: {
    fontSize: 10,
    letterSpacing: 3,
    textAlign: "center",
  },
  valueText: {
    fontSize: 10,
    textAlign: "center",
  },
  formNumber: {
    position: "absolute",
    bottom: 28,
    right: 48,
    fontSize: 9,
  },
});

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

export function CertificateLedgerPDF(props: CertificateLedgerPDFProps) {
  const { certificateNumber, studentName, applicantNumber, issuedAt, expiresAt } = props;

  const rightBodyHeight = BODY_ROW_HEIGHT * RIGHT_BODY_ROW_COUNT;

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.formLabelWrap}>
          <Text style={styles.formLabel}>{CERTIFICATE_LEDGER_FORM_LABEL}</Text>
        </View>

        <Text style={styles.title}>{CERTIFICATE_LEDGER_TITLE}</Text>

        <View style={styles.table}>
          {/* ヘッダー: 契印（割印） / 修了証明番号 */}
          <View style={styles.row}>
            <View
              style={[
                styles.cell,
                styles.headerCell,
                { width: SEAL_COLUMN_WIDTH, height: HEADER_ROW_HEIGHT },
              ]}
            >
              <Text style={styles.headerText}>契印（割印）</Text>
            </View>
            <View
              style={[
                styles.cell,
                styles.headerCell,
                { width: RIGHT_COLUMN_WIDTH, height: HEADER_ROW_HEIGHT },
              ]}
            >
              <Text style={styles.headerText}>修了証明番号</Text>
            </View>
          </View>

          {/* 本体: 契印欄 (縦結合の空欄) + 右側の明細 */}
          <View style={styles.row}>
            <View style={[styles.cell, { width: SEAL_COLUMN_WIDTH, height: rightBodyHeight }]} />

            <View style={styles.column}>
              {/* 証明番号 */}
              <View style={styles.row}>
                <View style={[styles.cell, { width: NUMBER_CELL_WIDTH, height: BODY_ROW_HEIGHT }]}>
                  <Text style={styles.valueText}>{certificateNumber}</Text>
                </View>
                <View
                  style={[styles.cell, { width: NUMBER_TRAILING_WIDTH, height: BODY_ROW_HEIGHT }]}
                />
              </View>

              {/* 修了日 / 有効期限 */}
              <View style={styles.row}>
                <View style={[styles.cell, { width: RIGHT_HALF_WIDTH, height: BODY_ROW_HEIGHT }]}>
                  <Text style={styles.valueText}>{formatJstDate(issuedAt)}修了</Text>
                </View>
                <View style={[styles.cell, { width: RIGHT_HALF_WIDTH, height: BODY_ROW_HEIGHT }]}>
                  <Text style={styles.valueText}>{formatJstDate(expiresAt)}まで</Text>
                </View>
              </View>

              {/* 氏名 / 技能証明申請者番号 (ヘッダー) */}
              <View style={styles.row}>
                <View
                  style={[
                    styles.cell,
                    styles.headerCell,
                    { width: RIGHT_HALF_WIDTH, height: BODY_ROW_HEIGHT },
                  ]}
                >
                  <Text style={styles.headerText}>氏名</Text>
                </View>
                <View
                  style={[
                    styles.cell,
                    styles.headerCell,
                    { width: RIGHT_HALF_WIDTH, height: BODY_ROW_HEIGHT },
                  ]}
                >
                  <Text style={styles.headerText}>技能証明申請者番号</Text>
                </View>
              </View>

              {/* 氏名 / 申請者番号 (値) */}
              <View style={styles.row}>
                <View style={[styles.cell, { width: RIGHT_HALF_WIDTH, height: BODY_ROW_HEIGHT }]}>
                  <Text style={styles.valueText}>{studentName}</Text>
                </View>
                <View style={[styles.cell, { width: RIGHT_HALF_WIDTH, height: BODY_ROW_HEIGHT }]}>
                  <Text style={styles.valueText}>{applicantNumber}</Text>
                </View>
              </View>

              {/* 区分: 回転翼航空機（マルチ） */}
              <View style={styles.row}>
                <View
                  style={[
                    styles.cell,
                    styles.headerCell,
                    { width: RIGHT_COLUMN_WIDTH, height: BODY_ROW_HEIGHT },
                  ]}
                >
                  <Text style={styles.valueText}>{MACHINE_CATEGORY_LABEL}</Text>
                </View>
              </View>

              {/* 限定欄 (非該当) */}
              <View style={styles.row}>
                <View
                  style={[
                    styles.cell,
                    styles.headerCell,
                    { width: RIGHT_QUARTER_WIDTH, height: BODY_ROW_HEIGHT },
                  ]}
                />
                <View style={[styles.cell, { width: RIGHT_QUARTER_WIDTH, height: BODY_ROW_HEIGHT }]}>
                  <Text style={styles.valueText}>{NOT_APPLICABLE}</Text>
                </View>
                <View style={[styles.cell, { width: RIGHT_QUARTER_WIDTH, height: BODY_ROW_HEIGHT }]}>
                  <Text style={styles.valueText}>{NOT_APPLICABLE}</Text>
                </View>
                <View style={[styles.cell, { width: RIGHT_QUARTER_WIDTH, height: BODY_ROW_HEIGHT }]}>
                  <Text style={styles.valueText}>{NOT_APPLICABLE}</Text>
                </View>
              </View>

              {/* 等級: 二等 */}
              <View style={styles.row}>
                <View style={[styles.cell, { width: RIGHT_QUARTER_WIDTH, height: BODY_ROW_HEIGHT }]}>
                  <Text style={styles.valueText}>{GRADE_LABEL}</Text>
                </View>
                <View style={[styles.cell, { width: RIGHT_QUARTER_WIDTH, height: BODY_ROW_HEIGHT }]}>
                  <Text style={styles.valueText}>{NOT_APPLICABLE}</Text>
                </View>
                <View style={[styles.cell, { width: RIGHT_QUARTER_WIDTH, height: BODY_ROW_HEIGHT }]}>
                  <Text style={styles.valueText}>{NOT_APPLICABLE}</Text>
                </View>
                <View style={[styles.cell, { width: RIGHT_QUARTER_WIDTH, height: BODY_ROW_HEIGHT }]}>
                  <Text style={styles.valueText}>{NOT_APPLICABLE}</Text>
                </View>
              </View>
            </View>
          </View>
        </View>

        <Text style={styles.formNumber}>{CERTIFICATE_LEDGER_FORM_NUMBER}</Text>
      </Page>
    </Document>
  );
}
