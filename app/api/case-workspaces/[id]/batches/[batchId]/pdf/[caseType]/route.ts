import { requireCaseWorkspaceReadAccess } from "@/lib/auth/case-workspace-guards";
import { getCaseWorkspaceById } from "@/lib/case-workspaces";
import { getPvsSubmissionBatchDetail } from "@/lib/services/pvs-submission-service";
import { renderPvsSubmissionPdf } from "@/lib/services/pdf/render-pvs-submission-pdf";
import { CASE_TYPE_LABELS } from "@/lib/services/pdf/pvs-submission-document";
import { badRequest, notFound, mapServiceError } from "@/lib/http";
import type { CaseType } from "@/lib/services/case-file-service";

const VALID_CASE_TYPES: CaseType[] = ["ambulant", "stationaer", "konsil"];

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string; batchId: string; caseType: string }> }
) {
  const { id, batchId, caseType } = await context.params;
  const access = await requireCaseWorkspaceReadAccess(request.headers, id);
  if (access.response) return access.response;

  if (!VALID_CASE_TYPES.includes(caseType as CaseType)) {
    return badRequest("Invalid case type");
  }

  try {
    const workspace = await getCaseWorkspaceById(id);
    if (!workspace) return notFound("Workspace not found");

    const detail = await getPvsSubmissionBatchDetail(id, batchId);
    const caseFiles = detail.groupedByCaseType[caseType as CaseType];

    if (caseFiles.length === 0) {
      return notFound("No case files of this type in this batch");
    }

    const buffer = await renderPvsSubmissionPdf({
      workspaceName: workspace.name,
      submittedOn: detail.batch.submittedOn,
      title: `PVS-Übermittlung — ${CASE_TYPE_LABELS[caseType as CaseType]}`,
      sections: [
        {
          caseType: caseType as CaseType,
          caseFiles: caseFiles.map((caseFile) => ({
            patientName: caseFile.patientName,
            fileNumber: caseFile.fileNumber,
            dateOfBirth: caseFile.dateOfBirth,
          })),
        },
      ],
    });

    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="PVS_${caseType}_${detail.batch.submittedOn}.pdf"`,
      },
    });
  } catch (error) {
    return mapServiceError(error);
  }
}
