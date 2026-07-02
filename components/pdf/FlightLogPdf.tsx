import { Document, Page, View, Text, StyleSheet } from "@react-pdf/renderer";
import {
  INSPECTION_ITEM_LABELS,
  INSPECTION_RESULT_LABELS,
  INSPECTION_PHASE_LABELS,
} from "@/lib/constants/inspectionItems";
import type { InspectionItemKey } from "@/lib/constants/inspectionItems";
import type { InspectionPhase, InspectionResult } from "@/types/prisma";

export interface FlightLogPdfInspection {
  phase: InspectionPhase;
  itemKey: string;
  result: InspectionResult;
  note: string | null;
}

export interface FlightLogPdfProps {
  pilotName: string;
  aircraftName: string;
  aircraftManufacturer: string;
  registrationNumber: string | null;
  location: string;
  purpose: string | null;
  startedAt: Date;
  endedAt: Date;
  durationMin: number;
  pilotNote: string | null;
  incidentNote: string | null;
  inspections: FlightLogPdfInspection[];
}

/**
 * 飛行日誌 様式1 (飛行記録) 相当のレイアウト。
 *
 * 国交省「無人航空機の飛行日誌 様式1」の記載事項 (飛行年月日・操縦者・機体・
 * 飛行場所・飛行時間・点検結果・特記事項) を簡略化した一覧表形式で出力する。
 * 公式様式の罫線レイアウトの完全再現は行わない (Phase 4 以降の課題)。
 * フォントは generateFlightLogPdf 側で Font.register 済みの "NotoSansJP" を使用する。
 */

const BORDER_COLOR = "#000000";

const styles = StyleSheet.create({
  page: {
    fontFamily: "NotoSansJP",
    paddingHorizontal: 48,
    paddingTop: 45,
    paddingBottom: 45,
    fontSize: 10,
    color: "#000000",
  },
  title: {
    fontSize: 16,
    textAlign: "center",
    marginBottom: 4,
  },
  formLabel: {
    fontSize: 9,
    textAlign: "right",
    marginBottom: 12,
  },
  table: {
    borderWidth: 1,
    borderColor: BORDER_COLOR,
    marginBottom: 16,
  },
  row: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: BORDER_COLOR,
  },
  lastRow: {
    flexDirection: "row",
  },
  labelCell: {
    width: 130,
    padding: 6,
    borderRightWidth: 1,
    borderRightColor: BORDER_COLOR,
    backgroundColor: "#f0f0f0",
  },
  valueCell: {
    flex: 1,
    padding: 6,
  },
  sectionTitle: {
    fontSize: 11,
    marginBottom: 6,
  },
  inspectionRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: BORDER_COLOR,
  },
  inspectionItemCell: {
    width: 180,
    padding: 4,
    borderRightWidth: 1,
    borderRightColor: BORDER_COLOR,
  },
  inspectionResultCell: {
    width: 60,
    padding: 4,
    borderRightWidth: 1,
    borderRightColor: BORDER_COLOR,
    textAlign: "center",
  },
  inspectionNoteCell: {
    flex: 1,
    padding: 4,
  },
});

function formatJstDate(date: Date): string {
  return date.toLocaleDateString("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

function formatJstTime(date: Date): string {
  return date.toLocaleTimeString("ja-JP", {
    timeZone: "Asia/Tokyo",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function inspectionLabel(itemKey: string): string {
  return INSPECTION_ITEM_LABELS[itemKey as InspectionItemKey] ?? itemKey;
}

function InspectionTable({ inspections }: { inspections: FlightLogPdfInspection[] }) {
  if (inspections.length === 0) {
    return <Text>点検記録なし</Text>;
  }
  return (
    <View style={styles.table}>
      {inspections.map((inspection, index) => (
        <View
          key={`${inspection.phase}-${inspection.itemKey}`}
          style={index === inspections.length - 1 ? styles.lastRow : styles.inspectionRow}
        >
          <Text style={styles.inspectionItemCell}>{inspectionLabel(inspection.itemKey)}</Text>
          <Text style={styles.inspectionResultCell}>
            {INSPECTION_RESULT_LABELS[inspection.result]}
          </Text>
          <Text style={styles.inspectionNoteCell}>{inspection.note ?? ""}</Text>
        </View>
      ))}
    </View>
  );
}

export function FlightLogPdf(props: FlightLogPdfProps) {
  const preFlight = props.inspections.filter((i) => i.phase === "PRE_FLIGHT");
  const postFlight = props.inspections.filter((i) => i.phase === "POST_FLIGHT");

  const summaryRows: Array<{ label: string; value: string }> = [
    { label: "飛行年月日", value: formatJstDate(props.startedAt) },
    { label: "操縦者氏名", value: props.pilotName },
    {
      label: "機体名称・登録番号",
      value: `${props.aircraftName} (${props.aircraftManufacturer}) / ${props.registrationNumber ?? "未登録"}`,
    },
    { label: "飛行場所", value: props.location },
    { label: "飛行目的", value: props.purpose ?? "―" },
    {
      label: "飛行時間",
      value: `${formatJstTime(props.startedAt)} 〜 ${formatJstTime(props.endedAt)} (${props.durationMin} 分)`,
    },
  ];

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>飛行記録</Text>
        <Text style={styles.formLabel}>様式１</Text>

        <View style={styles.table}>
          {summaryRows.map((row, index) => (
            <View
              key={row.label}
              style={index === summaryRows.length - 1 ? styles.lastRow : styles.row}
            >
              <Text style={styles.labelCell}>{row.label}</Text>
              <Text style={styles.valueCell}>{row.value}</Text>
            </View>
          ))}
        </View>

        <Text style={styles.sectionTitle}>{INSPECTION_PHASE_LABELS.PRE_FLIGHT}</Text>
        <InspectionTable inspections={preFlight} />

        <Text style={styles.sectionTitle}>{INSPECTION_PHASE_LABELS.POST_FLIGHT}</Text>
        <InspectionTable inspections={postFlight} />

        <Text style={styles.sectionTitle}>特記事項</Text>
        <View style={styles.table}>
          <View style={styles.lastRow}>
            <Text style={styles.valueCell}>
              {[props.pilotNote, props.incidentNote].filter(Boolean).join("\n") || "なし"}
            </Text>
          </View>
        </View>
      </Page>
    </Document>
  );
}
