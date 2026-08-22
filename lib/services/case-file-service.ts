import { and, asc, count, desc, eq, gte, inArray, like, lte, or, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  caseFileComments,
  caseFiles,
  caseFileStatusHistory,
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

export type CaseFileSortKey =
  | "createdAt"
  | "patientName"
  | "fileNumber"
  | "dateOfBirth"
  | "status"
  | "lastStatusChangeAt";
export type CaseFileSortDir = "asc" | "desc";

export type CaseFileFilters = {
  status?: CaseFileStatus;
  caseType?: CaseType;
  batchId?: string;
  q?: string;
  /** "YYYY-MM-DD" — inclusive range filter on the PVS batch's submission date.
   * Case files that were never submitted (no batch) never match either bound. */
  submittedFrom?: string;
  submittedTo?: string;
  /** Defaults to false — the board only shows archived case files when
   * explicitly asked for. */
  archived?: boolean;
  page?: number;
  sortKey?: CaseFileSortKey;
  sortDir?: CaseFileSortDir;
};

const STATUS_VALUES: CaseFileStatus[] = [
  "needs_processing",
  "medizin_controlling",
  "queued_for_pvs",
  "sent_to_pvs",
  "done",
];
const CASE_TYPE_VALUES: CaseType[] = ["ambulant", "stationaer", "konsil"];
const PAGE_SIZE = 25;

type CaseFileRow = typeof caseFiles.$inferSelect & {
  commentCount: number;
  lastStatusChangeAt: string;
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

function buildConditions(
  workspaceId: string,
  filters: CaseFileFilters,
  options: { skipStatus?: boolean; skipCaseType?: boolean } = {}
) {
  const conditions = [
    eq(caseFiles.workspaceId, workspaceId),
    eq(caseFiles.isArchived, filters.archived ?? false),
  ];

  if (filters.status && !options.skipStatus) {
    conditions.push(eq(caseFiles.status, filters.status));
  }
  if (filters.caseType && !options.skipCaseType) {
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
  if (filters.submittedFrom) {
    conditions.push(gte(pvsSubmissionBatches.submittedOn, filters.submittedFrom));
  }
  if (filters.submittedTo) {
    conditions.push(lte(pvsSubmissionBatches.submittedOn, filters.submittedTo));
  }

  return conditions;
}

function resolveOrderBy(
  sortKey: CaseFileSortKey = "lastStatusChangeAt",
  sortDir: CaseFileSortDir = "desc"
) {
  const dir = sortDir === "asc" ? asc : desc;
  switch (sortKey) {
    case "patientName":
      return dir(caseFiles.patientName);
    case "fileNumber":
      return dir(caseFiles.fileNumber);
    case "dateOfBirth":
      return dir(caseFiles.dateOfBirth);
    case "status":
      // Business-process order (intake → done) reads better than an alphabetical one.
      return dir(sql`case ${caseFiles.status}
        when 'needs_processing' then 0
        when 'medizin_controlling' then 1
        when 'queued_for_pvs' then 2
        when 'sent_to_pvs' then 3
        when 'done' then 4
        else 5 end`);
    case "lastStatusChangeAt":
      return dir(
        sql`(select max(${caseFileStatusHistory.createdAt}) from ${caseFileStatusHistory} where ${caseFileStatusHistory.caseFileId} = ${caseFiles.id})`
      );
    case "createdAt":
    default:
      return dir(caseFiles.createdAt);
  }
}

async function countByGroup<T extends string>(
  workspaceId: string,
  filters: CaseFileFilters,
  column: typeof caseFiles.status | typeof caseFiles.caseType,
  values: T[],
  options: { skipStatus?: boolean; skipCaseType?: boolean }
) {
  const rows = await db
    .select({ group: column, value: count() })
    .from(caseFiles)
    .leftJoin(pvsSubmissionBatches, eq(pvsSubmissionBatches.id, caseFiles.submissionBatchId))
    .where(and(...buildConditions(workspaceId, filters, options)))
    .groupBy(column);

  const counts = Object.fromEntries(values.map((value) => [value, 0])) as Record<T, number>;
  for (const row of rows) {
    counts[row.group as T] = row.value;
  }
  const all = values.reduce((sum, value) => sum + counts[value], 0);
  return { ...counts, all };
}

export async function listCaseFiles(
  workspaceId: string,
  filters: CaseFileFilters,
  permission: TrackerPermission | null
) {
  const page = filters.page && filters.page > 0 ? Math.floor(filters.page) : 1;
  const offset = (page - 1) * PAGE_SIZE;
  const conditions = buildConditions(workspaceId, filters);

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
      isArchived: caseFiles.isArchived,
      createdByUserId: caseFiles.createdByUserId,
      createdAt: caseFiles.createdAt,
      updatedAt: caseFiles.updatedAt,
      commentCount: sql<number>`(select count(*) from ${caseFileComments} where ${caseFileComments.caseFileId} = ${caseFiles.id})`,
      lastStatusChangeAt: sql<string>`(select max(${caseFileStatusHistory.createdAt}) from ${caseFileStatusHistory} where ${caseFileStatusHistory.caseFileId} = ${caseFiles.id})`,
    })
    .from(caseFiles)
    .leftJoin(pvsSubmissionBatches, eq(pvsSubmissionBatches.id, caseFiles.submissionBatchId))
    .where(and(...conditions))
    .orderBy(resolveOrderBy(filters.sortKey, filters.sortDir))
    .limit(PAGE_SIZE)
    .offset(offset);

  const items = rows.map((row) => hydrate(row, permission));

  const [countRow] = await db
    .select({ value: count() })
    .from(caseFiles)
    .leftJoin(pvsSubmissionBatches, eq(pvsSubmissionBatches.id, caseFiles.submissionBatchId))
    .where(and(...conditions));
  const totalCount = countRow?.value ?? 0;

  const [statusCounts, caseTypeCounts] = await Promise.all([
    countByGroup(workspaceId, filters, caseFiles.status, STATUS_VALUES, { skipStatus: true }),
    countByGroup(workspaceId, filters, caseFiles.caseType, CASE_TYPE_VALUES, { skipCaseType: true }),
  ]);

  return {
    items,
    page,
    pageSize: PAGE_SIZE,
    totalCount,
    hasMore: totalCount > offset + items.length,
    statusCounts,
    caseTypeCounts,
  };
}

/** Cap for listCaseFileIds — comfortably above any realistic single-batch
 * or single-return-cycle case load, just a safety bound against runaway
 * "select all matching" bulk actions. */
const SELECT_ALL_IDS_CAP = 2000;

/**
 * Fetches every case file id matching the given filters, unpaginated (up to
 * a safety cap), for the board's "select all N matching" bulk-selection
 * action — the normal listCaseFiles page is capped at PAGE_SIZE rows, which
 * isn't enough once a batch/return-cycle spans more than one page.
 */
export async function listCaseFileIds(workspaceId: string, filters: CaseFileFilters) {
  const conditions = buildConditions(workspaceId, filters);

  const rows = await db
    .select({ id: caseFiles.id })
    .from(caseFiles)
    .leftJoin(pvsSubmissionBatches, eq(pvsSubmissionBatches.id, caseFiles.submissionBatchId))
    .where(and(...conditions))
    .orderBy(resolveOrderBy(filters.sortKey, filters.sortDir))
    .limit(SELECT_ALL_IDS_CAP);

  return rows.map((row) => row.id);
}

/**
 * Fetches an arbitrary, manually picked set of case files by id (scoped to
 * the workspace) for the "export exactly what I selected" PDF flow.
 */
export async function listCaseFilesByIds(workspaceId: string, caseFileIds: string[]) {
  const uniqueIds = [...new Set(caseFileIds)];
  if (uniqueIds.length === 0) {
    return [];
  }

  return db
    .select({
      id: caseFiles.id,
      patientName: caseFiles.patientName,
      fileNumber: caseFiles.fileNumber,
      dateOfBirth: caseFiles.dateOfBirth,
      caseType: caseFiles.caseType,
    })
    .from(caseFiles)
    .where(and(eq(caseFiles.workspaceId, workspaceId), inArray(caseFiles.id, uniqueIds)))
    .orderBy(asc(caseFiles.patientName));
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

async function recordStatusHistory(
  caseFileId: string,
  status: CaseFileStatus,
  changedByUserId: string | null
) {
  await db.insert(caseFileStatusHistory).values({ caseFileId, status, changedByUserId });
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

  await recordStatusHistory(caseFile.id, "needs_processing", actorUserId);

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

  const [updated] = await db
    .update(caseFiles)
    .set({
      patientName: data.patientName,
      fileNumber: data.fileNumber,
      dateOfBirth: data.dateOfBirth === undefined ? undefined : data.dateOfBirth,
      caseType: data.caseType,
      isArchived: data.isArchived,
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
  caseFileIds: string[],
  actorUserId: string
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

  await Promise.all(
    uniqueIds.map((id) => recordStatusHistory(id, "medizin_controlling", actorUserId))
  );

  return db.select().from(caseFiles).where(inArray(caseFiles.id, uniqueIds));
}

export async function bulkMarkQueuedForPvs(
  workspaceId: string,
  caseFileIds: string[],
  actorUserId: string
) {
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

  await Promise.all(uniqueIds.map((id) => recordStatusHistory(id, "queued_for_pvs", actorUserId)));

  return db.select().from(caseFiles).where(inArray(caseFiles.id, uniqueIds));
}

export async function bulkMarkDone(
  workspaceId: string,
  caseFileIds: string[],
  actorUserId: string
) {
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

  await Promise.all(uniqueIds.map((id) => recordStatusHistory(id, "done", actorUserId)));

  return db.select().from(caseFiles).where(inArray(caseFiles.id, uniqueIds));
}

export async function bulkMarkReturned(
  workspaceId: string,
  caseFileIds: string[],
  actorUserId: string
) {
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

  await Promise.all(
    uniqueIds.map((id) => recordStatusHistory(id, "needs_processing", actorUserId))
  );

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

export async function listCaseFileStatusHistory(caseFileId: string) {
  return db
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
    .where(eq(caseFileStatusHistory.caseFileId, caseFileId))
    .orderBy(asc(caseFileStatusHistory.createdAt));
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
