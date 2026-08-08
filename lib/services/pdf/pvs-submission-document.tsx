import { Document, Page, View, Text, StyleSheet } from "@react-pdf/renderer";
import type { CaseType } from "@/lib/services/case-file-service";

export const CASE_TYPE_LABELS: Record<CaseType, string> = {
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
  sectionHeading: {
    fontSize: 12,
    fontWeight: 700,
    marginTop: 12,
    marginBottom: 6,
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

export type PvsSubmissionDocumentSection = {
  caseType: CaseType;
  caseFiles: Array<{
    patientName: string;
    fileNumber: string;
    dateOfBirth: string | null;
  }>;
};

export type PvsSubmissionDocumentProps = {
  workspaceName: string;
  submittedOn: string;
  title: string;
  /** Defaults to "Übermittlungsdatum". */
  dateLabel?: string;
  /** One table per section. A per-section heading only renders when there's more than one. */
  sections: PvsSubmissionDocumentSection[];
  generatedAt: Date;
};

export function PvsSubmissionDocument({
  workspaceName,
  submittedOn,
  title,
  dateLabel = "Übermittlungsdatum",
  sections,
  generatedAt,
}: PvsSubmissionDocumentProps) {
  const totalCount = sections.reduce((sum, section) => sum + section.caseFiles.length, 0);

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.subtitle}>
          {workspaceName} · {dateLabel}: {formatGermanDate(submittedOn)} · {totalCount}{" "}
          {totalCount === 1 ? "Patient" : "Patienten"}
        </Text>

        {sections.map((section) => (
          <View key={section.caseType}>
            {sections.length > 1 ? (
              <Text style={styles.sectionHeading}>{CASE_TYPE_LABELS[section.caseType]}</Text>
            ) : null}
            <View style={styles.table}>
              <View style={styles.row}>
                <Text style={[styles.headerCell, styles.colName]}>Patientenname</Text>
                <Text style={[styles.headerCell, styles.colFileNumber]}>Fall-/Aktennummer</Text>
                <Text style={[styles.headerCell, styles.colDob]}>Geburtsdatum</Text>
              </View>
              {section.caseFiles.map((caseFile, index) => (
                <View style={styles.row} key={index}>
                  <Text style={[styles.cell, styles.colName]}>{caseFile.patientName}</Text>
                  <Text style={[styles.cell, styles.colFileNumber]}>{caseFile.fileNumber}</Text>
                  <Text style={[styles.cell, styles.colDob]}>
                    {caseFile.dateOfBirth ? formatGermanDate(caseFile.dateOfBirth) : "-"}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        ))}

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
