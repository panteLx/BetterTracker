import { and, asc, desc, eq, gte, inArray, like, lt, or, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  caseFileComments,
  caseFiles,
  caseFileSubmissions,
  pvsSubmissionBatches,
  user,
} from "@/lib/db/schema";
import { canWriteTracker as canWriteWorkspace, type TrackerPermission } from "@/lib/auth/permissions";
import { caseFileInputSchema, caseFileUpdateSchema } from "@/lib/validators/case-file";
import { caseFileCommentInputSchema } from "@/lib/validators/case-file-comment";
import { ConflictError, NotFoundError, ValidationError } from "@/lib/errors";

export type CaseFileStatus =
  | "needs_processing"
  | "medizin_controlling"
  | "queued_for_pvs"
  | "sent_to_pvs"
  | "done";
export type CaseType = "ambulant" | "stationaer" | "konsil";

export type CaseFileFilters = {
  status?: CaseFileStatus;
  caseType?: CaseType;
  batchId?: string;
  q?: string;
  /** "YYYY-MM" — filters by the month the case file was created. */
  month?: string;
};

type CaseFileRow = typeof caseFiles.$inferSelect & {
  commentCount: number;
  submissionCount: number;
  batchSubmittedOn: string | null;
};

export type HydratedCaseFile = CaseFileRow & {
  canEdit: boolean;
  canDelete: boolean;
};

function hydrate(row: CaseFileRow, permission: TrackerPermission | null): HydratedCaseFile {
  const canMutate = canWriteWorkspace(permission);
  return {
    ...row,
    canEdit: canMutate,
    canDelete: canMutate,
  };
}

export async function listCaseFiles(
  workspaceId: string,
  filters: CaseFileFilters,
  permission: TrackerPermission | null
) {
  const conditions = [eq(caseFiles.workspaceId, workspaceId)];

  if (filters.status) {
    conditions.push(eq(caseFiles.status, filters.status));
  }
  if (filters.caseType) {
    conditions.push(eq(caseFiles.caseType, filters.caseType));
  }
  if (filters.batchId) {
    conditions.push(eq(caseFiles.submissionBatchId, filters.batchId));
  }
  if (filters.q?.trim()) {
    const matcher = `%${filters.q.trim()}%`;
    conditions.push(
      or(like(caseFiles.patientName, matcher), like(caseFiles.fileNumber, matcher))!
    );
  }
  if (filters.month) {
    const match = /^(\d{4})-(\d{2})$/.exec(filters.month);
    if (match) {
      const year = Number(match[1]);
      const month = Number(match[2]);
      const monthStart = new Date(year, month - 1, 1);
      const monthEnd = new Date(year, month, 1);
      conditions.push(gte(caseFiles.createdAt, monthStart), lt(caseFiles.createdAt, monthEnd));
    }
  }

  const rows = await db
    .select({
      id: caseFiles.id,
      workspaceId: caseFiles.workspaceId,
      patientName: caseFiles.patientName,
      fileNumber: caseFiles.fileNumber,
      dateOfBirth: caseFiles.dateOfBirth,
      caseType: caseFiles.caseType,
      status: caseFiles.status,
      submissionBatchId: caseFiles.submissionBatchId,
      returnCount: caseFiles.returnCount,
      lastReturnedAt: caseFiles.lastReturnedAt,
      createdByUserId: caseFiles.createdByUserId,
      createdAt: caseFiles.createdAt,
      updatedAt: caseFiles.updatedAt,
      batchSubmittedOn: pvsSubmissionBatches.submittedOn,
      commentCount: sql<number>`(select count(*) from ${caseFileComments} where ${caseFileComments.caseFileId} = ${caseFiles.id})`,
      submissionCount: sql<number>`(select count(*) from ${caseFileSubmissions} where ${caseFileSubmissions.caseFileId} = ${caseFiles.id})`,
    })
    .from(caseFiles)
    .leftJoin(pvsSubmissionBatches, eq(pvsSubmissionBatches.id, caseFiles.submissionBatchId))
    .where(and(...conditions))
    .orderBy(desc(caseFiles.createdAt));

  return rows.map((row) => hydrate(row, permission));
}

async function assertFileNumberAvailable(
  workspaceId: string,
  fileNumber: string,
  excludeCaseFileId?: string
) {
  const conditions = [
    eq(caseFiles.workspaceId, workspaceId),
    eq(caseFiles.fileNumber, fileNumber),
  ];
  const rows = await db
    .select({ id: caseFiles.id })
    .from(caseFiles)
    .where(and(...conditions))
    .limit(2);

  const conflicting = rows.filter((row) => row.id !== excludeCaseFileId);
  if (conflicting.length > 0) {
    throw new ConflictError("A case file with this file number already exists");
  }
}

export async function getCaseFileById(workspaceId: string, caseFileId: string) {
  const rows = await db
    .select()
    .from(caseFiles)
    .where(and(eq(caseFiles.id, caseFileId), eq(caseFiles.workspaceId, workspaceId)))
    .limit(1);
  return rows[0] ?? null;
}

export async function createCaseFile(
  workspaceId: string,
  input: unknown,
  actorUserId: string
) {
  const data = caseFileInputSchema.parse(input);
  await assertFileNumberAvailable(workspaceId, data.fileNumber);

  const [caseFile] = await db
    .insert(caseFiles)
    .values({
      workspaceId,
      patientName: data.patientName,
      fileNumber: data.fileNumber,
      dateOfBirth: data.dateOfBirth ?? null,
      caseType: data.caseType,
      createdByUserId: actorUserId,
    })
    .returning();

  return caseFile;
}

export async function updateCaseFile(
  workspaceId: string,
  caseFileId: string,
  input: unknown,
  permission: TrackerPermission | null
) {
  const existing = await getCaseFileById(workspaceId, caseFileId);
  if (!existing) {
    throw new NotFoundError("Case file not found");
  }

  if (!canWriteWorkspace(permission)) {
    throw new ValidationError("You cannot edit this case file");
  }

  const data = caseFileUpdateSchema.parse(input);
  if (data.fileNumber && data.fileNumber !== existing.fileNumber) {
    await assertFileNumberAvailable(workspaceId, data.fileNumber, caseFileId);
  }
  if (data.status === "sent_to_pvs" && existing.status !== "sent_to_pvs") {
    throw new ValidationError(
      "Case files can only be sent to PVS via the PVS submission action"
    );
  }

  const [updated] = await db
    .update(caseFiles)
    .set({
      patientName: data.patientName,
      fileNumber: data.fileNumber,
      dateOfBirth: data.dateOfBirth === undefined ? undefined : data.dateOfBirth,
      caseType: data.caseType,
      status: data.status,
      updatedAt: new Date(),
    })
    .where(eq(caseFiles.id, caseFileId))
    .returning();

  return updated;
}

async function loadCandidates(workspaceId: string, caseFileIds: string[]) {
  const uniqueIds = [...new Set(caseFileIds)];
  const candidates = await db
    .select({ id: caseFiles.id, status: caseFiles.status })
    .from(caseFiles)
    .where(and(eq(caseFiles.workspaceId, workspaceId), inArray(caseFiles.id, uniqueIds)));

  if (candidates.length !== uniqueIds.length) {
    throw new NotFoundError("One or more case files were not found in this workspace");
  }

  return { uniqueIds, candidates };
}

export async function bulkAdvanceToMedizinControlling(
  workspaceId: string,
  caseFileIds: string[]
) {
  const { uniqueIds, candidates } = await loadCandidates(workspaceId, caseFileIds);

  const notReady = candidates.filter((row) => row.status !== "needs_processing");
  if (notReady.length > 0) {
    throw new ValidationError(
      "Only case files with status 'needs_processing' can be sent to Medizin-Controlling"
    );
  }

  await db
    .update(caseFiles)
    .set({ status: "medizin_controlling", updatedAt: new Date() })
    .where(and(eq(caseFiles.workspaceId, workspaceId), inArray(caseFiles.id, uniqueIds)));

  return db.select().from(caseFiles).where(inArray(caseFiles.id, uniqueIds));
}

export async function bulkMarkQueuedForPvs(workspaceId: string, caseFileIds: string[]) {
  const { uniqueIds, candidates } = await loadCandidates(workspaceId, caseFileIds);

  const notReady = candidates.filter((row) => row.status !== "medizin_controlling");
  if (notReady.length > 0) {
    throw new ValidationError(
      "Only case files with status 'medizin_controlling' can be queued for PVS"
    );
  }

  await db
    .update(caseFiles)
    .set({ status: "queued_for_pvs", updatedAt: new Date() })
    .where(and(eq(caseFiles.workspaceId, workspaceId), inArray(caseFiles.id, uniqueIds)));

  return db.select().from(caseFiles).where(inArray(caseFiles.id, uniqueIds));
}

export async function bulkMarkDone(workspaceId: string, caseFileIds: string[]) {
  const { uniqueIds, candidates } = await loadCandidates(workspaceId, caseFileIds);

  const notReady = candidates.filter((row) => row.status !== "sent_to_pvs");
  if (notReady.length > 0) {
    throw new ValidationError(
      "Only case files with status 'sent_to_pvs' can be marked as done"
    );
  }

  await db
    .update(caseFiles)
    .set({ status: "done", updatedAt: new Date() })
    .where(and(eq(caseFiles.workspaceId, workspaceId), inArray(caseFiles.id, uniqueIds)));

  return db.select().from(caseFiles).where(inArray(caseFiles.id, uniqueIds));
}

export async function bulkMarkReturned(workspaceId: string, caseFileIds: string[]) {
  const { uniqueIds, candidates } = await loadCandidates(workspaceId, caseFileIds);

  const notReady = candidates.filter((row) => row.status !== "sent_to_pvs");
  if (notReady.length > 0) {
    throw new ValidationError(
      "Only case files with status 'sent_to_pvs' can be marked as returned"
    );
  }

  const now = new Date();
  await db
    .update(caseFiles)
    .set({
      status: "needs_processing",
      returnCount: sql`${caseFiles.returnCount} + 1`,
      lastReturnedAt: now,
      updatedAt: now,
    })
    .where(and(eq(caseFiles.workspaceId, workspaceId), inArray(caseFiles.id, uniqueIds)));

  return db.select().from(caseFiles).where(inArray(caseFiles.id, uniqueIds));
}

export async function deleteCaseFile(
  workspaceId: string,
  caseFileId: string,
  permission: TrackerPermission | null
) {
  const existing = await getCaseFileById(workspaceId, caseFileId);
  if (!existing) {
    throw new NotFoundError("Case file not found");
  }

  if (!canWriteWorkspace(permission)) {
    throw new ValidationError("You cannot delete this case file");
  }

  await db.delete(caseFiles).where(eq(caseFiles.id, caseFileId));
}

export async function listCaseFileComments(caseFileId: string) {
  return db
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
    .where(eq(caseFileComments.caseFileId, caseFileId))
    .orderBy(asc(caseFileComments.createdAt));
}

export async function addCaseFileComment(
  workspaceId: string,
  caseFileId: string,
  input: unknown,
  actorUserId: string
) {
  const existing = await getCaseFileById(workspaceId, caseFileId);
  if (!existing) {
    throw new NotFoundError("Case file not found");
  }

  const data = caseFileCommentInputSchema.parse(input);

  const [comment] = await db
    .insert(caseFileComments)
    .values({
      caseFileId,
      authorUserId: actorUserId,
      body: data.body,
    })
    .returning();

  return comment;
}

export async function deleteCaseFileComment(
  caseFileId: string,
  commentId: string,
  permission: TrackerPermission | null
) {
  const rows = await db
    .select()
    .from(caseFileComments)
    .where(and(eq(caseFileComments.id, commentId), eq(caseFileComments.caseFileId, caseFileId)))
    .limit(1);
  const comment = rows[0];
  if (!comment) {
    throw new NotFoundError("Comment not found");
  }

  if (!canWriteWorkspace(permission)) {
    throw new ValidationError("You cannot delete this comment");
  }

  await db.delete(caseFileComments).where(eq(caseFileComments.id, commentId));
}
