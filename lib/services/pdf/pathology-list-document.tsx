import { Document, Page, View, Text, StyleSheet } from "@react-pdf/renderer";
import type { PathologyEntry, PathologyListSummary } from "@/lib/services/pathology-service";
import type { PathologyTreatmentType } from "@/lib/validators/pathology";

export const PATHOLOGY_TREATMENT_LABELS: Record<PathologyTreatmentType, string> = {
  stat: "Stat.",
  hybrid: "Hybrid",
  aop: "AOP",
};

export function formatPathologyAnswer(
  entry: Pick<PathologyEntry, "insuranceNumber" | "insurer" | "note">
) {
  const parts = [entry.insuranceNumber?.trim(), entry.insurer?.trim()].filter(Boolean);
  const main = parts.join(" - ");
  const note = entry.note?.trim();
  if (!note) return main;
  return main ? `${main} (${note})` : `(${note})`;
}

export function formatGermanDate(iso: string | null) {
  if (!iso) return "";
  const [year, month, day] = iso.split("-");
  return `${day}.${month}.${year}`;
}

const COLUMN_WIDTHS = {
  sample: 72,
  patient: 160,
  received: 54,
  liquid: 24,
  sender: 62,
  material: 156,
  treatment: 48,
  answer: 190,
};

const TABLE_WIDTH = Object.values(COLUMN_WIDTHS).reduce((sum, width) => sum + width, 0);

const styles = StyleSheet.create({
  page: { padding: 28, fontSize: 8, fontFamily: "Helvetica" },
  title: { fontSize: 12, fontWeight: 700, marginBottom: 8 },
  row: { flexDirection: "row" },
  cell: {
    borderRight: "0.5pt solid #000000",
    borderBottom: "0.5pt solid #000000",
    padding: 2,
  },
  headerCell: { backgroundColor: "#cfcfd1", fontWeight: 700 },
  cancerRow: { backgroundColor: "#ff6600" },
  table: { width: TABLE_WIDTH, borderTop: "0.5pt solid #000000", borderLeft: "0.5pt solid #000000" },
});

type Props = { list: PathologyListSummary & { entries: PathologyEntry[] } };

function Cell({ width, children, header }: { width: number; children?: string; header?: boolean }) {
  return (
    <View style={[styles.cell, header ? styles.headerCell : {}, { width }]}>
      <Text>{children ?? ""}</Text>
    </View>
  );
}

export function PathologyListDocument({ list }: Props) {
  const headers: Array<[keyof typeof COLUMN_WIDTHS, string]> = [
    ["sample", "Proben-Nr"],
    ["patient", "Patient"],
    ["received", "Eingang"],
    ["liquid", "Liq"],
    ["sender", "Einsender"],
    ["material", "Material"],
    ["treatment", ""],
    ["answer", ""],
  ];

  return (
    <Document>
      <Page size="A4" orientation="landscape" style={styles.page}>
        <Text style={styles.title}>
          Patientenliste: Zeitraum {formatGermanDate(list.periodStart)} bis{" "}
          {formatGermanDate(list.periodEnd)}
        </Text>
        <View style={styles.table}>
          <View style={styles.row} fixed>
            {headers.map(([key, label]) => (
              <Cell key={key} width={COLUMN_WIDTHS[key]} header>
                {label}
              </Cell>
            ))}
          </View>
          {list.entries.map((entry) => (
            <View
              key={entry.id}
              style={[styles.row, entry.isCancerRegistry ? styles.cancerRow : {}]}
              wrap={false}
            >
              <Cell width={COLUMN_WIDTHS.sample}>{entry.sampleNumber}</Cell>
              <Cell width={COLUMN_WIDTHS.patient}>
                {entry.dateOfBirth
                  ? `${entry.patientName} *${formatGermanDate(entry.dateOfBirth)}`
                  : entry.patientName}
              </Cell>
              <Cell width={COLUMN_WIDTHS.received}>{formatGermanDate(entry.receivedDate)}</Cell>
              <Cell width={COLUMN_WIDTHS.liquid}>{entry.liquid ?? ""}</Cell>
              <Cell width={COLUMN_WIDTHS.sender}>{entry.sender ?? ""}</Cell>
              <Cell width={COLUMN_WIDTHS.material}>{entry.material ?? ""}</Cell>
              <Cell width={COLUMN_WIDTHS.treatment}>
                {entry.treatmentType ? PATHOLOGY_TREATMENT_LABELS[entry.treatmentType] : ""}
              </Cell>
              <Cell width={COLUMN_WIDTHS.answer}>{formatPathologyAnswer(entry)}</Cell>
            </View>
          ))}
        </View>
      </Page>
    </Document>
  );
}
