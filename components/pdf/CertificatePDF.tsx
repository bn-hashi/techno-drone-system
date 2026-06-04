import { Document, Page, View, Text, StyleSheet } from "@react-pdf/renderer";

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

// 様式1 のレイアウト
// 法定文言の正確な配置は別 Issue で調整可能、本 PR は最低限の文字配置に留める。
// フォントは pdfGenerator 側で Font.register 済みの "NotoSansJP" を使用する。
const styles = StyleSheet.create({
  page: {
    fontFamily: "NotoSansJP",
    padding: 50,
    fontSize: 10,
    color: "#1f2937",
  },
  header: {
    textAlign: "right",
    fontSize: 9,
    marginBottom: 10,
  },
  title: {
    fontSize: 22,
    textAlign: "center",
    marginVertical: 30,
    letterSpacing: 4,
  },
  certNumber: {
    textAlign: "right",
    fontSize: 11,
    marginBottom: 20,
  },
  block: {
    marginBottom: 12,
    lineHeight: 1.6,
  },
  blockLabel: {
    fontSize: 9,
    color: "#6b7280",
    marginBottom: 2,
  },
  blockValue: {
    fontSize: 12,
  },
  studentName: {
    fontSize: 18,
    marginVertical: 20,
    textAlign: "center",
  },
  table: {
    marginTop: 20,
    borderWidth: 1,
    borderColor: "#d1d5db",
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#d1d5db",
  },
  tableRowLast: {
    flexDirection: "row",
  },
  tableHeaderCell: {
    flex: 1,
    padding: 6,
    fontSize: 10,
    backgroundColor: "#f3f4f6",
    borderRightWidth: 1,
    borderRightColor: "#d1d5db",
  },
  tableCell: {
    flex: 1,
    padding: 6,
    fontSize: 10,
    borderRightWidth: 1,
    borderRightColor: "#d1d5db",
  },
  tableCellLast: {
    flex: 1,
    padding: 6,
    fontSize: 10,
  },
  footer: {
    marginTop: 40,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: "#d1d5db",
    fontSize: 10,
    lineHeight: 1.6,
  },
  footerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 4,
  },
});

function formatJstDate(date: Date): string {
  return new Intl.DateTimeFormat("ja-JP", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "Asia/Tokyo",
  }).format(date);
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

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.header}>様式1 (D検様式240302-01)</Text>
        <Text style={styles.certNumber}>{certificateNumber}</Text>

        <Text style={styles.title}>修 了 証 明 書</Text>

        <Text style={styles.studentName}>{studentName} 殿</Text>

        <View style={styles.block}>
          <Text style={styles.blockLabel}>技能証明申請者番号</Text>
          <Text style={styles.blockValue}>{applicantNumber}</Text>
        </View>

        <View style={styles.block}>
          <Text>
            上記の者は、当登録講習機関において、無人航空機操縦者技能証明 (二等)
            に係る所定の学科講習課程を修了したことを証明します。
          </Text>
        </View>

        <View style={styles.block}>
          <Text style={styles.blockLabel}>修了日</Text>
          <Text style={styles.blockValue}>{formatJstDate(issuedAt)}</Text>
        </View>

        <View style={styles.block}>
          <Text style={styles.blockLabel}>有効期限</Text>
          <Text style={styles.blockValue}>{formatJstDate(expiresAt)}</Text>
        </View>

        {/* 区分表: 二等・回転翼マルチ・基本 */}
        <View style={styles.table}>
          <View style={styles.tableRow}>
            <Text style={styles.tableHeaderCell}>等級</Text>
            <Text style={styles.tableHeaderCell}>機体種別</Text>
            <Text style={styles.tableHeaderCell}>限定解除事項</Text>
          </View>
          <View style={styles.tableRowLast}>
            <Text style={styles.tableCell}>二等</Text>
            <Text style={styles.tableCell}>回転翼航空機 (マルチローター)</Text>
            <Text style={styles.tableCellLast}>基本</Text>
          </View>
        </View>

        <View style={styles.footer}>
          <View style={styles.footerRow}>
            <Text>登録講習機関コード:</Text>
            <Text>{institutionCode}</Text>
          </View>
          <View style={styles.footerRow}>
            <Text>登録講習機関名:</Text>
            <Text>{institutionName}</Text>
          </View>
          <View style={styles.footerRow}>
            <Text>スクール名:</Text>
            <Text>{schoolName}</Text>
          </View>
          <View style={styles.footerRow}>
            <Text>講習事務所コード:</Text>
            <Text>{trainingOfficeCode}</Text>
          </View>
          <View style={styles.footerRow}>
            <Text>修了審査員:</Text>
            <Text>{examinerName}</Text>
          </View>
        </View>
      </Page>
    </Document>
  );
}
