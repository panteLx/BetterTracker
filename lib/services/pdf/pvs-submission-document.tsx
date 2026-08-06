import { Document, Page, View, Text, StyleSheet } from "@react-pdf/renderer";
import type { CaseType } from "@/lib/services/case-file-service";

const CASE_TYPE_LABELS: Record<CaseType, string> = {
  ambulant: "Ambulant",
  stationaer: "Stationär",
  konsil: "Konsil",
};

const styles = StyleSheet.create({
  page: {
    padding: 32,
    fontSize: 10,
    fontFamily: "Helvetica",
  },
  title: {
    fontSize: 16,
    fontWeight: 700,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 11,
    color: "#475569",
    marginBottom: 16,
  },
  table: {
    display: "flex",
    flexDirection: "column",
    borderTop: "1pt solid #cbd5e1",
    borderLeft: "1pt solid #cbd5e1",
  },
  row: {
    flexDirection: "row",
  },
  headerCell: {
    flexGrow: 1,
    borderRight: "1pt solid #cbd5e1",
    borderBottom: "1pt solid #cbd5e1",
    backgroundColor: "#f1f5f9",
    padding: 6,
    fontWeight: 700,
  },
  cell: {
    flexGrow: 1,
    borderRight: "1pt solid #cbd5e1",
    borderBottom: "1pt solid #cbd5e1",
    padding: 6,
  },
  colName: { flexBasis: "45%" },
  colFileNumber: { flexBasis: "30%" },
  colDob: { flexBasis: "25%" },
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

function formatGermanDate(dateString: string) {
  const [year, month, day] = dateString.split("-");
  return `${day}.${month}.${year}`;
}

export type PvsSubmissionDocumentProps = {
  workspaceName: string;
  submittedOn: string;
  caseType: CaseType;
  caseFiles: Array<{
    patientName: string;
    fileNumber: string;
    dateOfBirth: string | null;
  }>;
  generatedAt: Date;
};

export function PvsSubmissionDocument({
  workspaceName,
  submittedOn,
  caseType,
  caseFiles,
  generatedAt,
}: PvsSubmissionDocumentProps) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>PVS-Übermittlung — {CASE_TYPE_LABELS[caseType]}</Text>
        <Text style={styles.subtitle}>
          {workspaceName} · Übermittlungsdatum: {formatGermanDate(submittedOn)} · {caseFiles.length}{" "}
          {caseFiles.length === 1 ? "Patient" : "Patienten"}
        </Text>

        <View style={styles.table}>
          <View style={styles.row}>
            <Text style={[styles.headerCell, styles.colName]}>Patientenname</Text>
            <Text style={[styles.headerCell, styles.colFileNumber]}>Fall-/Aktennummer</Text>
            <Text style={[styles.headerCell, styles.colDob]}>Geburtsdatum</Text>
          </View>
          {caseFiles.map((caseFile, index) => (
            <View style={styles.row} key={index}>
              <Text style={[styles.cell, styles.colName]}>{caseFile.patientName}</Text>
              <Text style={[styles.cell, styles.colFileNumber]}>{caseFile.fileNumber}</Text>
              <Text style={[styles.cell, styles.colDob]}>
                {caseFile.dateOfBirth ? formatGermanDate(caseFile.dateOfBirth) : "-"}
              </Text>
            </View>
          ))}
        </View>

        <View style={styles.footer} fixed>
          <Text>Erstellt am {generatedAt.toLocaleString("de-DE")}</Text>
          <Text
            render={({ pageNumber, totalPages }) => `Seite ${pageNumber} von ${totalPages}`}
          />
        </View>
      </Page>
    </Document>
  );
}
