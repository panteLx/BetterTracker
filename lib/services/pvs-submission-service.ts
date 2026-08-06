import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { caseFiles, caseFileSubmissions, pvsSubmissionBatches } from "@/lib/db/schema";
import { toDateInputValue } from "@/lib/utils";
import { ValidationError, NotFoundError } from "@/lib/errors";
import type { CaseType } from "@/lib/services/case-file-service";

export async function sendCaseFilesToPvs(
  workspaceId: string,
  caseFileIds: string[],
  actorUserId: string
) {
  const uniqueIds = [...new Set(caseFileIds)];

  const candidates = await db
    .select({ id: caseFiles.id, status: caseFiles.status })
    .from(caseFiles)
    .where(and(eq(caseFiles.workspaceId, workspaceId), inArray(caseFiles.id, uniqueIds)));

  if (candidates.length !== uniqueIds.length) {
    throw new ValidationError("One or more case files were not found in this workspace");
  }

  const notReady = candidates.filter(
    (row) => row.status !== "medizin_controlling" && row.status !== "queued_for_pvs"
  );
  if (notReady.length > 0) {
    throw new ValidationError(
      "Only case files with status 'medizin_controlling' or 'queued_for_pvs' can be sent to PVS"
    );
  }

  return db.transaction((tx) => {
    const [batch] = tx
      .insert(pvsSubmissionBatches)
      .values({
        workspaceId,
        submittedOn: toDateInputValue(new Date()),
        createdByUserId: actorUserId,
      })
      .returning()
      .all();

    tx.update(caseFiles)
      .set({
        submissionBatchId: batch.id,
        status: "sent_to_pvs",
        updatedAt: new Date(),
      })
      .where(and(eq(caseFiles.workspaceId, workspaceId), inArray(caseFiles.id, uniqueIds)))
      .run();

    tx.insert(caseFileSubmissions)
      .values(uniqueIds.map((caseFileId) => ({ caseFileId, batchId: batch.id })))
      .run();

    const updatedCaseFiles = tx
      .select()
      .from(caseFiles)
      .where(inArray(caseFiles.id, uniqueIds))
      .all();

    return { batch, caseFiles: updatedCaseFiles };
  });
}

export async function listPvsSubmissionBatches(
  workspaceId: string,
  options?: { isHidden?: boolean }
) {
  const isHidden = options?.isHidden ?? false;
  const batches = await db
    .select()
    .from(pvsSubmissionBatches)
    .where(
      and(eq(pvsSubmissionBatches.workspaceId, workspaceId), eq(pvsSubmissionBatches.isHidden, isHidden))
    )
    .orderBy(sql`${pvsSubmissionBatches.submittedOn} desc`, sql`${pvsSubmissionBatches.createdAt} desc`);

  if (batches.length === 0) {
    return [];
  }

  const counts = await db
    .select({
      batchId: caseFileSubmissions.batchId,
      caseType: caseFiles.caseType,
      count: sql<number>`count(*)`,
    })
    .from(caseFileSubmissions)
    .innerJoin(caseFiles, eq(caseFiles.id, caseFileSubmissions.caseFileId))
    .where(
      inArray(
        caseFileSubmissions.batchId,
        batches.map((batch) => batch.id)
      )
    )
    .groupBy(caseFileSubmissions.batchId, caseFiles.caseType);

  return batches.map((batch) => {
    const caseTypeCounts: Record<CaseType, number> = {
      ambulant: 0,
      stationaer: 0,
      konsil: 0,
    };
    for (const row of counts) {
      if (row.batchId === batch.id) {
        caseTypeCounts[row.caseType as CaseType] = row.count;
      }
    }
    return { ...batch, caseTypeCounts };
  });
}

export async function setPvsSubmissionBatchHidden(
  workspaceId: string,
  batchId: string,
  isHidden: boolean
) {
  const batch = await getPvsSubmissionBatch(workspaceId, batchId);
  if (!batch) {
    throw new NotFoundError("Batch not found");
  }

  const [updated] = await db
    .update(pvsSubmissionBatches)
    .set({ isHidden })
    .where(eq(pvsSubmissionBatches.id, batchId))
    .returning();

  return updated;
}

export async function getPvsSubmissionBatch(workspaceId: string, batchId: string) {
  const rows = await db
    .select()
    .from(pvsSubmissionBatches)
    .where(and(eq(pvsSubmissionBatches.id, batchId), eq(pvsSubmissionBatches.workspaceId, workspaceId)))
    .limit(1);
  return rows[0] ?? null;
}

export async function getPvsSubmissionBatchDetail(workspaceId: string, batchId: string) {
  const batch = await getPvsSubmissionBatch(workspaceId, batchId);
  if (!batch) {
    throw new NotFoundError("Batch not found");
  }

  const rows = await db
    .select({ id: caseFiles.id, patientName: caseFiles.patientName, fileNumber: caseFiles.fileNumber, dateOfBirth: caseFiles.dateOfBirth, caseType: caseFiles.caseType, status: caseFiles.status })
    .from(caseFileSubmissions)
    .innerJoin(caseFiles, eq(caseFiles.id, caseFileSubmissions.caseFileId))
    .where(eq(caseFileSubmissions.batchId, batchId));

  const grouped: Record<CaseType, typeof rows> = {
    ambulant: [],
    stationaer: [],
    konsil: [],
  };
  for (const row of rows) {
    grouped[row.caseType as CaseType].push(row);
  }

  return { batch, caseFiles: rows, groupedByCaseType: grouped };
}
