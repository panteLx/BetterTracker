import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { caseFiles, caseFileStatusHistory, caseInvoices } from "@/lib/db/schema";
import { NotFoundError, ValidationError } from "@/lib/errors";
import {
  deleteInvoiceFile,
  readInvoiceFile,
  saveInvoiceFile,
} from "@/lib/storage/invoice-files";

export const MAX_INVOICE_BYTES = 10 * 1024 * 1024;

export type InvoiceCaseFile = { id: string; patientName: string; fileNumber: string };

export type CaseInvoice = {
  id: string;
  workspaceId: string;
  originalFileName: string;
  sizeBytes: number;
  createdAt: Date;
  caseFiles: InvoiceCaseFile[];
};

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

async function hydrateInvoices(
  rows: (typeof caseInvoices.$inferSelect)[]
): Promise<CaseInvoice[]> {
  if (rows.length === 0) return [];
  const linked = await db
    .select({
      id: caseFiles.id,
      invoiceId: caseFiles.invoiceId,
      patientName: caseFiles.patientName,
      fileNumber: caseFiles.fileNumber,
    })
    .from(caseFiles)
    .where(
      inArray(
        caseFiles.invoiceId,
        rows.map((row) => row.id)
      )
    )
    .orderBy(asc(caseFiles.patientName));

  return rows.map((row) => ({
    id: row.id,
    workspaceId: row.workspaceId,
    originalFileName: row.originalFileName,
    sizeBytes: row.sizeBytes,
    createdAt: row.createdAt,
    caseFiles: linked
      .filter((file) => file.invoiceId === row.id)
      .map(({ id, patientName, fileNumber }) => ({ id, patientName, fileNumber })),
  }));
}

async function loadInvoiceRow(workspaceId: string, invoiceId: string) {
  const [row] = await db
    .select()
    .from(caseInvoices)
    .where(and(eq(caseInvoices.id, invoiceId), eq(caseInvoices.workspaceId, workspaceId)))
    .limit(1);
  if (!row) throw new NotFoundError("Invoice not found");
  return row;
}

export async function listInvoices(workspaceId: string) {
  const rows = await db
    .select()
    .from(caseInvoices)
    .where(eq(caseInvoices.workspaceId, workspaceId))
    .orderBy(desc(caseInvoices.createdAt));
  return hydrateInvoices(rows);
}

export async function getInvoice(workspaceId: string, invoiceId: string) {
  const row = await loadInvoiceRow(workspaceId, invoiceId);
  const [invoice] = await hydrateInvoices([row]);
  return invoice;
}

export async function listAssignableCaseFiles(workspaceId: string): Promise<InvoiceCaseFile[]> {
  return db
    .select({
      id: caseFiles.id,
      patientName: caseFiles.patientName,
      fileNumber: caseFiles.fileNumber,
    })
    .from(caseFiles)
    .where(
      and(
        eq(caseFiles.workspaceId, workspaceId),
        eq(caseFiles.status, "awaiting_invoice"),
        eq(caseFiles.isArchived, false)
      )
    )
    .orderBy(asc(caseFiles.patientName));
}

// better-sqlite3 transactions are synchronous: everything inside uses .all()/.run().
function assignInTx(
  tx: Tx,
  workspaceId: string,
  invoiceId: string,
  caseFileIds: string[],
  actorUserId: string
) {
  const ids = [...new Set(caseFileIds)];
  if (ids.length === 0) return;

  const rows = tx
    .select({
      id: caseFiles.id,
      status: caseFiles.status,
      invoiceId: caseFiles.invoiceId,
      isArchived: caseFiles.isArchived,
    })
    .from(caseFiles)
    .where(and(eq(caseFiles.workspaceId, workspaceId), inArray(caseFiles.id, ids)))
    .all();

  if (rows.length !== ids.length) {
    throw new NotFoundError("One or more case files were not found in this workspace");
  }
  const ineligible = rows.some(
    (row) => row.status !== "awaiting_invoice" || row.invoiceId !== null || row.isArchived
  );
  if (ineligible) {
    throw new ValidationError(
      "Only active case files with status 'awaiting_invoice' and no invoice can be assigned"
    );
  }

  tx.update(caseFiles)
    .set({ invoiceId, status: "done", updatedAt: new Date() })
    .where(inArray(caseFiles.id, ids))
    .run();
  tx.insert(caseFileStatusHistory)
    .values(ids.map((id) => ({ caseFileId: id, status: "done" as const, changedByUserId: actorUserId })))
    .run();
}

function unassignInTx(
  tx: Tx,
  workspaceId: string,
  invoiceId: string,
  caseFileIds: string[],
  actorUserId: string,
  options: { allowArchived: boolean }
) {
  const ids = [...new Set(caseFileIds)];
  if (ids.length === 0) return;

  const rows = tx
    .select({ id: caseFiles.id, invoiceId: caseFiles.invoiceId, isArchived: caseFiles.isArchived })
    .from(caseFiles)
    .where(and(eq(caseFiles.workspaceId, workspaceId), inArray(caseFiles.id, ids)))
    .all();

  if (rows.length !== ids.length) {
    throw new NotFoundError("One or more case files were not found in this workspace");
  }
  if (rows.some((row) => row.invoiceId !== invoiceId)) {
    throw new ValidationError("One or more case files are not assigned to this invoice");
  }
  if (!options.allowArchived && rows.some((row) => row.isArchived)) {
    throw new ValidationError("Archived case files cannot be changed");
  }

  tx.update(caseFiles)
    .set({ invoiceId: null, status: "awaiting_invoice", updatedAt: new Date() })
    .where(inArray(caseFiles.id, ids))
    .run();
  tx.insert(caseFileStatusHistory)
    .values(
      ids.map((id) => ({
        caseFileId: id,
        status: "awaiting_invoice" as const,
        changedByUserId: actorUserId,
      }))
    )
    .run();
}

export async function uploadInvoice(
  workspaceId: string,
  file: { name: string; bytes: Buffer },
  caseFileIds: string[],
  actorUserId: string
) {
  if (file.bytes.length === 0 || file.bytes.length > MAX_INVOICE_BYTES) {
    throw new ValidationError("Invoice must be a PDF of at most 10 MB");
  }
  if (file.bytes.subarray(0, 5).toString("latin1") !== "%PDF-") {
    throw new ValidationError("Invoice must be a PDF file");
  }

  const invoiceId = crypto.randomUUID();
  await saveInvoiceFile(workspaceId, invoiceId, file.bytes);

  try {
    db.transaction((tx) => {
      tx.insert(caseInvoices)
        .values({
          id: invoiceId,
          workspaceId,
          originalFileName: file.name.slice(0, 255) || "invoice.pdf",
          sizeBytes: file.bytes.length,
          uploadedByUserId: actorUserId,
        })
        .run();
      assignInTx(tx, workspaceId, invoiceId, caseFileIds, actorUserId);
    });
  } catch (error) {
    await deleteInvoiceFile(workspaceId, invoiceId);
    throw error;
  }

  return getInvoice(workspaceId, invoiceId);
}

export async function assignCaseFiles(
  workspaceId: string,
  invoiceId: string,
  caseFileIds: string[],
  actorUserId: string
) {
  await loadInvoiceRow(workspaceId, invoiceId);
  db.transaction((tx) => assignInTx(tx, workspaceId, invoiceId, caseFileIds, actorUserId));
  return getInvoice(workspaceId, invoiceId);
}

export async function unassignCaseFiles(
  workspaceId: string,
  invoiceId: string,
  caseFileIds: string[],
  actorUserId: string
) {
  await loadInvoiceRow(workspaceId, invoiceId);
  db.transaction((tx) =>
    unassignInTx(tx, workspaceId, invoiceId, caseFileIds, actorUserId, { allowArchived: false })
  );
  return getInvoice(workspaceId, invoiceId);
}

export async function deleteInvoice(workspaceId: string, invoiceId: string, actorUserId: string) {
  await loadInvoiceRow(workspaceId, invoiceId);

  db.transaction((tx) => {
    const linked = tx
      .select({ id: caseFiles.id })
      .from(caseFiles)
      .where(eq(caseFiles.invoiceId, invoiceId))
      .all();
    // Archived files are reverted too, otherwise they would keep a dangling done status.
    unassignInTx(
      tx,
      workspaceId,
      invoiceId,
      linked.map((row) => row.id),
      actorUserId,
      { allowArchived: true }
    );
    tx.delete(caseInvoices).where(eq(caseInvoices.id, invoiceId)).run();
  });

  await deleteInvoiceFile(workspaceId, invoiceId);
}

export async function getInvoiceFile(workspaceId: string, invoiceId: string) {
  const row = await loadInvoiceRow(workspaceId, invoiceId);
  const bytes = await readInvoiceFile(workspaceId, invoiceId);
  if (!bytes) throw new NotFoundError("Invoice file not found");
  return { name: row.originalFileName, bytes };
}
