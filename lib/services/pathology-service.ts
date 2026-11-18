import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { pathologyListEntries, pathologyLists } from "@/lib/db/schema";
import { ConflictError, NotFoundError, ValidationError } from "@/lib/errors";
import { parsePathologyPdf, type ParsedPathologyEntry } from "@/lib/services/pathology-pdf-parser";
import type { CommitImportInput, UpdateEntryInput } from "@/lib/validators/pathology";

export type PathologyEntry = typeof pathologyListEntries.$inferSelect;

export type PathologyListSummary = {
  id: string;
  periodStart: string;
  periodEnd: string;
  sourceFileName: string;
  isArchived: boolean;
  entryCount: number;
  filledCount: number;
  openCancerRegistryCount: number;
  createdAt: Date;
};

const hasText = (value: string | null) => !!value && value.trim().length > 0;

function isFilled(entry: PathologyEntry) {
  return !!entry.treatmentType && hasText(entry.insurer) && hasText(entry.insuranceNumber);
}

function isOpenCancerRegistry(entry: PathologyEntry) {
  return entry.isCancerRegistry && !(hasText(entry.insurer) && hasText(entry.insuranceNumber));
}

function summarize(
  list: typeof pathologyLists.$inferSelect,
  entries: PathologyEntry[]
): PathologyListSummary {
  return {
    id: list.id,
    periodStart: list.periodStart,
    periodEnd: list.periodEnd,
    sourceFileName: list.sourceFileName,
    isArchived: list.isArchived,
    entryCount: entries.length,
    filledCount: entries.filter(isFilled).length,
    openCancerRegistryCount: entries.filter(isOpenCancerRegistry).length,
    createdAt: list.createdAt,
  };
}

async function loadListRow(workspaceId: string, listId: string) {
  const [row] = await db
    .select()
    .from(pathologyLists)
    .where(and(eq(pathologyLists.id, listId), eq(pathologyLists.workspaceId, workspaceId)))
    .limit(1);
  if (!row) throw new NotFoundError("List not found");
  return row;
}

export async function listPathologyLists(
  workspaceId: string,
  includeArchived: boolean
): Promise<PathologyListSummary[]> {
  const lists = await db
    .select()
    .from(pathologyLists)
    .where(
      includeArchived
        ? eq(pathologyLists.workspaceId, workspaceId)
        : and(eq(pathologyLists.workspaceId, workspaceId), eq(pathologyLists.isArchived, false))
    )
    .orderBy(desc(pathologyLists.periodStart), desc(pathologyLists.createdAt));
  if (lists.length === 0) return [];

  const entries = await db
    .select()
    .from(pathologyListEntries)
    .where(
      inArray(
        pathologyListEntries.listId,
        lists.map((list) => list.id)
      )
    );
  return lists.map((list) =>
    summarize(
      list,
      entries.filter((entry) => entry.listId === list.id)
    )
  );
}

export async function getPathologyList(
  workspaceId: string,
  listId: string
): Promise<PathologyListSummary & { entries: PathologyEntry[] }> {
  const list = await loadListRow(workspaceId, listId);
  const entries = await db
    .select()
    .from(pathologyListEntries)
    .where(eq(pathologyListEntries.listId, listId))
    .orderBy(asc(pathologyListEntries.position));
  return { ...summarize(list, entries), entries };
}

export async function updatePathologyEntry(
  workspaceId: string,
  listId: string,
  entryId: string,
  patch: UpdateEntryInput
): Promise<PathologyEntry> {
  const list = await loadListRow(workspaceId, listId);
  if (list.isArchived) throw new ConflictError("List is archived");

  const [existing] = await db
    .select({ id: pathologyListEntries.id })
    .from(pathologyListEntries)
    .where(and(eq(pathologyListEntries.id, entryId), eq(pathologyListEntries.listId, listId)))
    .limit(1);
  if (!existing) throw new NotFoundError("Entry not found");

  const values = Object.fromEntries(
    Object.entries(patch).filter(([, value]) => value !== undefined)
  );
  if (Object.keys(values).length > 0) {
    await db
      .update(pathologyListEntries)
      .set(values)
      .where(eq(pathologyListEntries.id, entryId));
  }

  const [row] = await db
    .select()
    .from(pathologyListEntries)
    .where(eq(pathologyListEntries.id, entryId))
    .limit(1);
  return row;
}

export async function setPathologyListArchived(
  workspaceId: string,
  listId: string,
  isArchived: boolean
): Promise<PathologyListSummary> {
  await loadListRow(workspaceId, listId);
  await db.update(pathologyLists).set({ isArchived }).where(eq(pathologyLists.id, listId));
  const { entries: _entries, ...summary } = await getPathologyList(workspaceId, listId);
  void _entries;
  return summary;
}

export async function listInsurerSuggestions(workspaceId: string): Promise<string[]> {
  const rows = await db
    .select({ insurer: pathologyListEntries.insurer, uses: sql<number>`count(*)` })
    .from(pathologyListEntries)
    .where(
      and(
        eq(pathologyListEntries.workspaceId, workspaceId),
        sql`${pathologyListEntries.insurer} is not null and trim(${pathologyListEntries.insurer}) <> ''`
      )
    )
    .groupBy(pathologyListEntries.insurer)
    .orderBy(desc(sql`count(*)`), asc(pathologyListEntries.insurer))
    .limit(100);
  return rows.map((row) => row.insurer as string);
}

export async function commitPathologyImport(
  workspaceId: string,
  input: CommitImportInput,
  actorUserId: string
): Promise<{ list: PathologyListSummary; importedCount: number; skippedCount: number }> {
  const listId = crypto.randomUUID();
  // Read and insert in one immediate transaction so concurrent imports cannot race
  // into the unique index (its error text would carry the whole batch's values).
  const importedCount = db.transaction(
    (tx) => {
      const existing = new Set(
        tx
          .select({ sampleNumber: pathologyListEntries.sampleNumber })
          .from(pathologyListEntries)
          .where(eq(pathologyListEntries.workspaceId, workspaceId))
          .all()
          .map((row) => row.sampleNumber)
      );
      const seen = new Set<string>();
      const fresh = input.entries.filter((entry) => {
        if (existing.has(entry.sampleNumber) || seen.has(entry.sampleNumber)) return false;
        seen.add(entry.sampleNumber);
        return true;
      });
      if (fresh.length === 0) throw new ConflictError("All entries already exist");

      tx.insert(pathologyLists)
        .values({
          id: listId,
          workspaceId,
          periodStart: input.periodStart,
          periodEnd: input.periodEnd,
          sourceFileName: input.sourceFileName,
          createdByUserId: actorUserId,
        })
        .run();
      tx.insert(pathologyListEntries)
        .values(
          fresh.map((entry, position) => ({
            workspaceId,
            listId,
            position,
            sampleNumber: entry.sampleNumber,
            patientName: entry.patientName,
            dateOfBirth: entry.dateOfBirth,
            receivedDate: entry.receivedDate,
            liquid: entry.liquid,
            sender: entry.sender,
            material: entry.material,
            isCancerRegistry: entry.isCancerRegistry,
          }))
        )
        .run();
      return fresh.length;
    },
    { behavior: "immediate" }
  );

  const { entries: _entries, ...list } = await getPathologyList(workspaceId, listId);
  void _entries;
  return {
    list,
    importedCount,
    skippedCount: input.entries.length - importedCount,
  };
}

export async function previewPathologyImport(
  workspaceId: string,
  bytes: Uint8Array
): Promise<{
  periodStart: string | null;
  periodEnd: string | null;
  entries: Array<ParsedPathologyEntry & { duplicate: boolean }>;
}> {
  const parsed = await parsePathologyPdf(bytes);
  if (parsed.entries.length === 0) {
    throw new ValidationError("No patient rows found in the PDF");
  }

  const existing = new Set(
    (
      await db
        .select({ sampleNumber: pathologyListEntries.sampleNumber })
        .from(pathologyListEntries)
        .where(eq(pathologyListEntries.workspaceId, workspaceId))
    ).map((row) => row.sampleNumber)
  );

  return {
    periodStart: parsed.periodStart,
    periodEnd: parsed.periodEnd,
    entries: parsed.entries.map((entry) => ({
      ...entry,
      duplicate: existing.has(entry.sampleNumber),
    })),
  };
}
