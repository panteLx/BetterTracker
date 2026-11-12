import { Document, Page, View, Text, StyleSheet } from "@react-pdf/renderer";
import { CASE_TYPE_LABELS } from "@/lib/services/pdf/pvs-submission-document";
import type { CaseFileStatus, CaseType } from "@/lib/services/case-file-service";

export const STATUS_LABELS: Record<CaseFileStatus, string> = {
  needs_processing: "In Bearbeitung",
  medizin_controlling: "Medizin-Controlling",
  queued_for_pvs: "Bereit für PVS",
  sent_to_pvs: "Zur PVS geschickt",
  awaiting_invoice: "Warten auf Ausgangsrechnung",
  done: "Fertig",
};

const styles = StyleSheet.create({
  page: { padding: 32, paddingBottom: 48, fontSize: 10, fontFamily: "Helvetica" },
  title: { fontSize: 16, fontWeight: 700, marginBottom: 4 },
  subtitle: { fontSize: 11, color: "#475569", marginBottom: 12 },
  heading: { fontSize: 12, fontWeight: 700, marginTop: 14, marginBottom: 6 },
  table: { borderTop: "1pt solid #cbd5e1", borderLeft: "1pt solid #cbd5e1" },
  row: { flexDirection: "row" },
  headerCell: {
    borderRight: "1pt solid #cbd5e1",
    borderBottom: "1pt solid #cbd5e1",
    backgroundColor: "#f1f5f9",
    padding: 5,
    fontWeight: 700,
  },
  cell: { borderRight: "1pt solid #cbd5e1", borderBottom: "1pt solid #cbd5e1", padding: 5 },
  note: { borderBottom: "1pt solid #e2e8f0", paddingVertical: 6 },
  noteMeta: { fontSize: 8, color: "#64748b", marginBottom: 2 },
  empty: { color: "#64748b" },
  footer: {
    position: "absolute",
    bottom: 24,
    left: 32,
    right: 32,
    fontSize: 8,
    color: "#94a3b8",
    flexDirection: "row",
    justifyContent: "space-between",
  },
});

export function formatDate(value: string | null | undefined) {
  if (!value) return "-";
  const [year, month, day] = value.split("-");
  return `${day}.${month}.${year}`;
}

export function formatDateTime(value: Date | null | undefined) {
  if (!value) return "-";
  return value.toLocaleString("de-DE", { timeZone: "Europe/Berlin" });
}

function Footer({ generatedAt }: { generatedAt: Date }) {
  return (
    <View style={styles.footer} fixed>
      <Text>Erstellt am {formatDateTime(generatedAt)}</Text>
      <Text render={({ pageNumber, totalPages }) => `Seite ${pageNumber} von ${totalPages}`} />
    </View>
  );
}

export type ExportCaseSummary = {
  patientName: string;
  fileNumber: string;
  dateOfBirth: string | null;
  caseType: CaseType;
  status: CaseFileStatus;
  isArchived: boolean;
  hasInvoice: boolean;
};

export function WorkspaceOverviewDocument({
  workspaceName,
  cases,
  generatedAt,
}: {
  workspaceName: string;
  cases: ExportCaseSummary[];
  generatedAt: Date;
}) {
  const cols = [
    { label: "Aktennummer", width: "15%" },
    { label: "Patientenname", width: "24%" },
    { label: "Geburtsdatum", width: "13%" },
    { label: "Falltyp", width: "11%" },
    { label: "Status", width: "21%" },
    { label: "Archiv", width: "7%" },
    { label: "Rechnung", width: "9%" },
  ];
  return (
    <Document>
      <Page size="A4" orientation="landscape" style={styles.page}>
        <Text style={styles.title}>Gesamtübersicht aller Akten</Text>
        <Text style={styles.subtitle}>
          {workspaceName} · {cases.length} {cases.length === 1 ? "Akte" : "Akten"}
        </Text>
        <View style={styles.table}>
          <View style={styles.row}>
            {cols.map((col) => (
              <Text key={col.label} style={[styles.headerCell, { width: col.width }]}>
                {col.label}
              </Text>
            ))}
          </View>
          {cases.map((item, index) => {
            const values = [
              item.fileNumber,
              item.patientName,
              formatDate(item.dateOfBirth),
              CASE_TYPE_LABELS[item.caseType],
              STATUS_LABELS[item.status],
              item.isArchived ? "Ja" : "-",
              item.hasInvoice ? "Ja" : "-",
            ];
            return (
              <View style={styles.row} key={index} wrap={false}>
                {values.map((value, i) => (
                  <Text key={i} style={[styles.cell, { width: cols[i].width }]}>
                    {value}
                  </Text>
                ))}
              </View>
            );
          })}
        </View>
        <Footer generatedAt={generatedAt} />
      </Page>
    </Document>
  );
}

export type CaseExportData = ExportCaseSummary & {
  workspaceName: string;
  createdAt: Date;
  returnCount: number;
  lastReturnedAt: Date | null;
  statusHistory: Array<{ status: CaseFileStatus; at: Date; by: string | null }>;
  submissions: Array<{ submittedOn: string; addedAt: Date }>;
  invoice: { fileName: string; fileMissing: boolean } | null;
  comments: Array<{ body: string; at: Date; author: string | null }>;
};

function KeyValueTable({ rows }: { rows: Array<[string, string]> }) {
  return (
    <View style={styles.table}>
      {rows.map(([label, value]) => (
        <View style={styles.row} key={label} wrap={false}>
          <Text style={[styles.headerCell, { width: "32%" }]}>{label}</Text>
          <Text style={[styles.cell, { width: "68%" }]}>{value}</Text>
        </View>
      ))}
    </View>
  );
}

export function CaseExportDocument({ data, generatedAt }: { data: CaseExportData; generatedAt: Date }) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>
          {data.fileNumber} · {data.patientName}
        </Text>
        <Text style={styles.subtitle}>{data.workspaceName}</Text>

        <Text style={styles.heading}>Stammdaten</Text>
        <KeyValueTable
          rows={[
            ["Patientenname", data.patientName],
            ["Fall-/Aktennummer", data.fileNumber],
            ["Geburtsdatum", formatDate(data.dateOfBirth)],
            ["Falltyp", CASE_TYPE_LABELS[data.caseType]],
            ["Aktueller Status", STATUS_LABELS[data.status]],
            ["Archiviert", data.isArchived ? "Ja" : "Nein"],
            ["Angelegt am", formatDateTime(data.createdAt)],
            [
              "Rückläufer von der PVS",
              data.returnCount > 0
                ? `${data.returnCount} (zuletzt ${formatDateTime(data.lastReturnedAt)})`
                : "0",
            ],
          ]}
        />

        <Text style={styles.heading}>Ausgangsrechnung</Text>
        {data.invoice ? (
          <Text>
            {data.invoice.fileName}
            {data.invoice.fileMissing
              ? " (Datei auf dem Server nicht gefunden, daher nicht im Export enthalten)"
              : " (siehe Rechnung.pdf im selben Ordner)"}
          </Text>
        ) : (
          <Text style={styles.empty}>Keine Rechnung zugeordnet.</Text>
        )}

        <Text style={styles.heading}>Einsendungen an die PVS</Text>
        {data.submissions.length === 0 ? (
          <Text style={styles.empty}>Keine Einsendungen.</Text>
        ) : (
          <View style={styles.table}>
            <View style={styles.row}>
              <Text style={[styles.headerCell, { width: "50%" }]}>Einsendedatum</Text>
              <Text style={[styles.headerCell, { width: "50%" }]}>Aufgenommen am</Text>
            </View>
            {data.submissions.map((entry, index) => (
              <View style={styles.row} key={index} wrap={false}>
                <Text style={[styles.cell, { width: "50%" }]}>{formatDate(entry.submittedOn)}</Text>
                <Text style={[styles.cell, { width: "50%" }]}>{formatDateTime(entry.addedAt)}</Text>
              </View>
            ))}
          </View>
        )}

        <Text style={styles.heading}>Statusverlauf</Text>
        {data.statusHistory.length === 0 ? (
          <Text style={styles.empty}>Kein Verlauf vorhanden.</Text>
        ) : (
          <View style={styles.table}>
            <View style={styles.row}>
              <Text style={[styles.headerCell, { width: "30%" }]}>Zeitpunkt</Text>
              <Text style={[styles.headerCell, { width: "40%" }]}>Status</Text>
              <Text style={[styles.headerCell, { width: "30%" }]}>Geändert von</Text>
            </View>
            {data.statusHistory.map((entry, index) => (
              <View style={styles.row} key={index} wrap={false}>
                <Text style={[styles.cell, { width: "30%" }]}>{formatDateTime(entry.at)}</Text>
                <Text style={[styles.cell, { width: "40%" }]}>{STATUS_LABELS[entry.status]}</Text>
                <Text style={[styles.cell, { width: "30%" }]}>{entry.by ?? "-"}</Text>
              </View>
            ))}
          </View>
        )}

        <Text style={styles.heading}>Notizen</Text>
        {data.comments.length === 0 ? (
          <Text style={styles.empty}>Keine Notizen.</Text>
        ) : (
          data.comments.map((comment, index) => (
            <View style={styles.note} key={index} wrap={false}>
              <Text style={styles.noteMeta}>
                {comment.author ?? "Unbekannt"} · {formatDateTime(comment.at)}
              </Text>
              <Text>{comment.body}</Text>
            </View>
          ))
        )}

        <Footer generatedAt={generatedAt} />
      </Page>
    </Document>
  );
}
