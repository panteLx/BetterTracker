import { requireCaseWorkspaceReadAccess } from "@/lib/auth/case-workspace-guards";
import { getCaseWorkspaceById } from "@/lib/case-workspaces";
import { listCaseFilesByIds } from "@/lib/services/case-file-service";
import { renderPvsSubmissionPdf } from "@/lib/services/pdf/render-pvs-submission-pdf";
import { CASE_TYPE_LABELS, type PvsSubmissionDocumentSection } from "@/lib/services/pdf/pvs-submission-document";
import { badRequest, notFound, mapServiceError, parseRequestJson } from "@/lib/http";
import { checkRateLimit } from "@/lib/rate-limit";
import { toDateInputValue } from "@/lib/utils";
import type { CaseType } from "@/lib/services/case-file-service";

const CASE_TYPE_ORDER: CaseType[] = ["ambulant", "stationaer", "konsil"];

/**
 * Exports a manually picked set of case files (any status, any case type)
 * as one PDF — the "select exactly what I want" complement to the
 * per-status/per-type export links on the board and batches pages.
 */
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const access = await requireCaseWorkspaceReadAccess(request.headers, id);
  if (access.response) return access.response;

  // Rendering a PDF is the most expensive thing a request can ask for here,
  // and the key is the session user id, which is not spoofable.
  const limited = checkRateLimit(`pdf:${access.user!.id}`, 20, 60_000);
  if (limited) return limited;

  try {
    const workspace = await getCaseWorkspaceById(id);
    if (!workspace) return notFound("Workspace not found");

    const body = await parseRequestJson<{ caseFileIds?: unknown }>(request);
    const caseFileIds = Array.isArray(body.caseFileIds)
      ? body.caseFileIds.filter((value): value is string => typeof value === "string")
      : [];
    if (caseFileIds.length === 0) {
      return badRequest("caseFileIds is required");
    }

    const caseFiles = await listCaseFilesByIds(id, caseFileIds);
    if (caseFiles.length === 0) {
      return notFound("No matching case files found");
    }

    const sections: PvsSubmissionDocumentSection[] = CASE_TYPE_ORDER.map((caseType) => ({
      caseType,
      caseFiles: caseFiles
        .filter((row) => row.caseType === caseType)
        .map((row) => ({
          patientName: row.patientName,
          fileNumber: row.fileNumber,
          dateOfBirth: row.dateOfBirth,
        })),
    })).filter((section) => section.caseFiles.length > 0);

    const asOf = toDateInputValue(new Date());
    const title =
      sections.length === 1
        ? `Ausgewählte Akten — ${CASE_TYPE_LABELS[sections[0].caseType]}`
        : "Ausgewählte Akten";

    const buffer = await renderPvsSubmissionPdf({
      workspaceName: workspace.name,
      submittedOn: asOf,
      title,
      dateLabel: "Stand",
      sections,
    });

    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="Ausgewaehlte_Akten_${asOf}.pdf"`,
      },
    });
  } catch (error) {
    return mapServiceError(error);
  }
}
