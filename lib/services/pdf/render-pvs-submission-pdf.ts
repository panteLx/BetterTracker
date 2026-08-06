import { renderToBuffer } from "@react-pdf/renderer";
import { PvsSubmissionDocument } from "@/lib/services/pdf/pvs-submission-document";
import type { CaseType } from "@/lib/services/case-file-service";

export type RenderPvsSubmissionPdfInput = {
  workspaceName: string;
  submittedOn: string;
  caseType: CaseType;
  caseFiles: Array<{
    patientName: string;
    fileNumber: string;
    dateOfBirth: string | null;
  }>;
};

export async function renderPvsSubmissionPdf(input: RenderPvsSubmissionPdfInput) {
  return renderToBuffer(
    PvsSubmissionDocument({
      ...input,
      generatedAt: new Date(),
    })
  );
}
