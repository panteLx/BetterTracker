import { renderToBuffer } from "@react-pdf/renderer";
import {
  PvsSubmissionDocument,
  type PvsSubmissionDocumentSection,
} from "@/lib/services/pdf/pvs-submission-document";

export type RenderPvsSubmissionPdfInput = {
  workspaceName: string;
  submittedOn: string;
  title: string;
  /** Defaults to "Übermittlungsdatum". */
  dateLabel?: string;
  sections: PvsSubmissionDocumentSection[];
};

export async function renderPvsSubmissionPdf(input: RenderPvsSubmissionPdfInput) {
  return renderToBuffer(
    PvsSubmissionDocument({
      ...input,
      generatedAt: new Date(),
    })
  );
}
