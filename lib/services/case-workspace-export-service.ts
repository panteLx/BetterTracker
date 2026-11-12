import { renderToBuffer } from "@react-pdf/renderer";
import { Zip, ZipPassThrough } from "fflate";
import { asc, eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  caseFileComments,
  caseFileStatusHistory,
  caseFileSubmissions,
  caseFiles,
  caseInvoices,
  pvsSubmissionBatches,
  user,
} from "@/lib/db/schema";
import { readInvoiceFile } from "@/lib/storage/invoice-files";
import {
  CaseExportDocument,
  WorkspaceOverviewDocument,
  type CaseExportData,
} from "@/lib/services/pdf/case-export-documents";

// Windows-forbidden and control characters; keeps folder names valid on every OS.
const UNSAFE_NAME_CHARS = /[\\/:*?"<>|\u0000-\u001f]/g;

function safeSegment(value: string) {
  return value.replace(UNSAFE_NAME_CHARS, "_").replace(/\s+/g, " ").trim().slice(0, 100);
}

type ExportEntry = { caseFile: typeof caseFiles.$inferSelect; folder: string };

function groupBy<T, K>(rows: T[], key: (row: T) => K) {
  const map = new Map<K, T[]>();
  for (const row of rows) {
    const k = key(row);
    const list = map.get(k);
    if (list) list.push(row);
    else map.set(k, [row]);
  }
  return map;
}

async function loadWorkspaceExportData(workspaceId: string) {
  const files = await db
    .select()
    .from(caseFiles)
    .where(eq(caseFiles.workspaceId, workspaceId))
    .orderBy(asc(caseFiles.fileNumber));
  const ids = files.map((file) => file.id);

  // Chunked to stay below SQLite's bound-parameter limit on large workspaces.
  const chunks: string[][] = [];
  for (let i = 0; i < ids.length; i += 500) chunks.push(ids.slice(i, i + 500));

  const comments: Array<typeof caseFileComments.$inferSelect & { authorName: string | null }> = [];
  const history: Array<typeof caseFileStatusHistory.$inferSelect & { changedByName: string | null }> =
    [];
  const submissions: Array<{
    caseFileId: string;
    addedAt: Date;
    submittedOn: string;
  }> = [];

  for (const chunk of chunks) {
    const [c, h, s] = await Promise.all([
      db
        .select({
          id: caseFileComments.id,
          caseFileId: caseFileComments.caseFileId,
          authorUserId: caseFileComments.authorUserId,
          body: caseFileComments.body,
          createdAt: caseFileComments.createdAt,
          authorName: user.name,
        })
        .from(caseFileComments)
        .leftJoin(user, eq(user.id, caseFileComments.authorUserId))
        .where(inArray(caseFileComments.caseFileId, chunk))
        .orderBy(asc(caseFileComments.createdAt)),
      db
        .select({
          id: caseFileStatusHistory.id,
          caseFileId: caseFileStatusHistory.caseFileId,
          status: caseFileStatusHistory.status,
          changedByUserId: caseFileStatusHistory.changedByUserId,
          createdAt: caseFileStatusHistory.createdAt,
          changedByName: user.name,
        })
        .from(caseFileStatusHistory)
        .leftJoin(user, eq(user.id, caseFileStatusHistory.changedByUserId))
        .where(inArray(caseFileStatusHistory.caseFileId, chunk))
        .orderBy(asc(caseFileStatusHistory.createdAt)),
      db
        .select({
          caseFileId: caseFileSubmissions.caseFileId,
          addedAt: caseFileSubmissions.createdAt,
          submittedOn: pvsSubmissionBatches.submittedOn,
        })
        .from(caseFileSubmissions)
        .innerJoin(pvsSubmissionBatches, eq(pvsSubmissionBatches.id, caseFileSubmissions.batchId))
        .where(inArray(caseFileSubmissions.caseFileId, chunk))
        .orderBy(asc(pvsSubmissionBatches.submittedOn)),
    ]);
    comments.push(...c);
    history.push(...h);
    submissions.push(...s);
  }

  const invoiceRows = await db
    .select()
    .from(caseInvoices)
    .where(eq(caseInvoices.workspaceId, workspaceId));

  return {
    files,
    commentsByCase: groupBy(comments, (row) => row.caseFileId),
    historyByCase: groupBy(history, (row) => row.caseFileId),
    submissionsByCase: groupBy(submissions, (row) => row.caseFileId),
    invoicesById: new Map(invoiceRows.map((row) => [row.id, row])),
  };
}

/**
 * Streams a ZIP with one folder per case file (Akte.pdf + the invoice PDF)
 * plus a workspace overview. Cases are rendered one at a time so memory
 * stays bounded regardless of workspace size.
 */
export async function createWorkspaceExportStream(workspaceId: string, workspaceName: string) {
  const data = await loadWorkspaceExportData(workspaceId);
  const generatedAt = new Date();

  const usedFolders = new Set<string>();
  const entries: ExportEntry[] = data.files.map((caseFile) => {
    const base = safeSegment(`${caseFile.fileNumber} ${caseFile.patientName}`) || caseFile.id;
    let folder = base;
    for (let n = 2; usedFolders.has(folder.toLowerCase()); n += 1) folder = `${base} (${n})`;
    usedFolders.add(folder.toLowerCase());
    return { caseFile, folder };
  });

  let controller!: ReadableStreamDefaultController<Uint8Array>;
  const zip = new Zip((error, chunk, final) => {
    if (error) {
      controller.error(error);
      return;
    }
    controller.enqueue(chunk);
    if (final) controller.close();
  });

  // PDFs are already compressed, so entries are stored as-is.
  function addFile(name: string, bytes: Uint8Array) {
    const file = new ZipPassThrough(name);
    zip.add(file);
    file.push(bytes, true);
  }

  async function addOverview() {
    const buffer = await renderToBuffer(
      WorkspaceOverviewDocument({
        workspaceName,
        generatedAt,
        cases: data.files.map((file) => ({
          patientName: file.patientName,
          fileNumber: file.fileNumber,
          dateOfBirth: file.dateOfBirth,
          caseType: file.caseType,
          status: file.status,
          isArchived: file.isArchived,
          hasInvoice: file.invoiceId !== null,
        })),
      })
    );
    addFile("Uebersicht.pdf", buffer);
  }

  async function addCase({ caseFile, folder }: ExportEntry) {
    const invoice = caseFile.invoiceId ? data.invoicesById.get(caseFile.invoiceId) : undefined;
    const invoiceBytes = invoice ? await readInvoiceFile(workspaceId, invoice.id) : null;

    const exportData: CaseExportData = {
      workspaceName,
      patientName: caseFile.patientName,
      fileNumber: caseFile.fileNumber,
      dateOfBirth: caseFile.dateOfBirth,
      caseType: caseFile.caseType,
      status: caseFile.status,
      isArchived: caseFile.isArchived,
      hasInvoice: Boolean(invoice),
      createdAt: caseFile.createdAt,
      returnCount: caseFile.returnCount,
      lastReturnedAt: caseFile.lastReturnedAt,
      statusHistory: (data.historyByCase.get(caseFile.id) ?? []).map((row) => ({
        status: row.status,
        at: row.createdAt,
        by: row.changedByName,
      })),
      submissions: (data.submissionsByCase.get(caseFile.id) ?? []).map((row) => ({
        submittedOn: row.submittedOn,
        addedAt: row.addedAt,
      })),
      invoice: invoice ? { fileName: invoice.originalFileName, fileMissing: !invoiceBytes } : null,
      comments: (data.commentsByCase.get(caseFile.id) ?? []).map((row) => ({
        body: row.body,
        at: row.createdAt,
        author: row.authorName,
      })),
    };

    const akte = await renderToBuffer(CaseExportDocument({ data: exportData, generatedAt }));
    addFile(`${folder}/Akte.pdf`, akte);
    if (invoiceBytes) addFile(`${folder}/Rechnung.pdf`, invoiceBytes);
  }

  // index -1 is the overview; afterwards one case per pull() so a slow
  // client applies backpressure instead of buffering the whole archive.
  let next = -1;
  return new ReadableStream<Uint8Array>({
    start(c) {
      controller = c;
    },
    async pull() {
      try {
        if (next === -1) await addOverview();
        else if (next < entries.length) await addCase(entries[next]);
        else {
          zip.end();
          return;
        }
        next += 1;
      } catch (error) {
        zip.terminate();
        controller.error(error);
      }
    },
    cancel() {
      zip.terminate();
    },
  });
}
