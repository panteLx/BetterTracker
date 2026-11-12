import { eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { appSettings, opsCodes, opsHybridCodes } from "@/lib/db/schema";
import { parseAnhang2, parseHybridList, type OpsEntry } from "@/lib/ops/parse";
import { opsFixedCodesSchema } from "@/lib/validators/ops";
import type { z } from "zod";

export type OpsFixedCodes = z.infer<typeof opsFixedCodesSchema>;

export const DEFAULT_OPS_FIXED_CODES: OpsFixedCodes = {
  letterPost: "40110",
  letterFax: "40111",
  flatUnder60: "07211",
  flatFrom60: "07212",
};

export type OpsResult = OpsEntry & { hybridDrg: boolean };

type DatasetFile = { fileName: string; uploadedAt: string; rowCount: number };
export type OpsDatasetInfo = { anhang2: DatasetFile | null; hybrid: DatasetFile | null };

const DATASET_KEY = "opsDatasetInfo";
const FIXED_CODES_KEY = "opsFixedCodes";
const SEARCH_LIMIT = 100;
const INSERT_CHUNK = 500;

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

function readSetting<T>(key: string, fallback: T): T {
  const row = db.select().from(appSettings).where(eq(appSettings.key, key)).limit(1).all()[0];
  return row ? (JSON.parse(row.valueJson) as T) : fallback;
}

// better-sqlite3 transactions are synchronous, so this uses .all()/.run().
function writeSetting(tx: Tx, key: string, value: unknown, userId: string | null) {
  const valueJson = JSON.stringify(value);
  const existing = tx.select({ id: appSettings.id }).from(appSettings).where(eq(appSettings.key, key)).all()[0];
  if (existing) {
    tx.update(appSettings)
      .set({ valueJson, updatedByUserId: userId, updatedAt: new Date() })
      .where(eq(appSettings.key, key))
      .run();
  } else {
    tx.insert(appSettings).values({ key, valueJson, updatedByUserId: userId }).run();
  }
}

export async function getOpsOverview(): Promise<{ fixedCodes: OpsFixedCodes; dataset: OpsDatasetInfo }> {
  return {
    fixedCodes: { ...DEFAULT_OPS_FIXED_CODES, ...readSetting<Partial<OpsFixedCodes>>(FIXED_CODES_KEY, {}) },
    dataset: readSetting<OpsDatasetInfo>(DATASET_KEY, { anhang2: null, hybrid: null }),
  };
}

const escapeLike = (s: string) => s.replace(/[\\%_]/g, (m) => `\\${m}`);

export type OpsSearchFilters = { hideHybrid?: boolean; hideNo115b?: boolean };

export async function searchOps(
  query: string,
  filters: OpsSearchFilters = {}
): Promise<{ items: OpsResult[]; total: number }> {
  const terms = query.trim().split(/\s+/).filter(Boolean);
  if (terms.length === 0) return { items: [], total: 0 };

  const codeExpr = sql`replace(replace(${opsCodes.opsCode}, '-', ''), '.', '')`;
  const conditions = terms.map((term) => {
    const plain = `%${escapeLike(term)}%`;
    const codeLike = `%${escapeLike(term.replace(/[-.]/g, ""))}%`;
    return sql`(${codeExpr} like ${codeLike} escape '\\' or ${opsCodes.description} like ${plain} escape '\\')`;
  });
  if (filters.hideHybrid) {
    conditions.push(sql`not exists (select 1 from ops_hybrid_codes h where h.ops_code = ops_codes.ops_code)`);
  }
  if (filters.hideNo115b) conditions.push(sql`ops_codes.aop_115b = 1`);
  const where = sql.join(conditions, sql` and `);

  const total = db.select({ n: sql<number>`count(*)` }).from(opsCodes).where(where).all()[0].n;
  const rows = db
    .select({
      opsCode: opsCodes.opsCode,
      description: opsCodes.description,
      operation: opsCodes.operation,
      monitoring: opsCodes.monitoring,
      anesthesia: opsCodes.anesthesia,
      funding: opsCodes.funding,
      hygiene: opsCodes.hygiene,
      aop115b: opsCodes.aop115b,
      // Qualified by hand: drizzle omits the table name in single-table selects, which would self-compare `h.ops_code`.
      hybridDrg: sql<number>`exists (select 1 from ops_hybrid_codes h where h.ops_code = ops_codes.ops_code)`,
    })
    .from(opsCodes)
    .where(where)
    .orderBy(opsCodes.opsCode)
    .limit(SEARCH_LIMIT)
    .all();

  return { items: rows.map((r) => ({ ...r, hybridDrg: Boolean(r.hybridDrg) })), total };
}

function chunks<T>(items: T[]): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += INSERT_CHUNK) out.push(items.slice(i, i + INSERT_CHUNK));
  return out;
}

function replaceDataset(
  kind: keyof OpsDatasetInfo,
  fileName: string,
  rowCount: number,
  userId: string | null,
  write: (tx: Tx) => void
): OpsDatasetInfo {
  return db.transaction((tx) => {
    write(tx);
    const current = readSetting<OpsDatasetInfo>(DATASET_KEY, { anhang2: null, hybrid: null });
    const next = { ...current, [kind]: { fileName, uploadedAt: new Date().toISOString(), rowCount } };
    writeSetting(tx, DATASET_KEY, next, userId);
    return next;
  });
}

export async function replaceAnhang2(bytes: Buffer, fileName: string, userId: string | null) {
  const entries = await parseAnhang2(bytes);
  return replaceDataset("anhang2", fileName, entries.length, userId, (tx) => {
    tx.delete(opsCodes).run();
    for (const part of chunks(entries)) tx.insert(opsCodes).values(part).run();
  });
}

export async function replaceHybridList(bytes: Buffer, fileName: string, userId: string | null) {
  const entries = await parseHybridList(bytes);
  return replaceDataset("hybrid", fileName, entries.length, userId, (tx) => {
    tx.delete(opsHybridCodes).run();
    for (const part of chunks(entries)) tx.insert(opsHybridCodes).values(part).run();
  });
}

export async function updateFixedCodes(input: OpsFixedCodes, userId: string | null) {
  const value = opsFixedCodesSchema.parse(input);
  db.transaction((tx) => writeSetting(tx, FIXED_CODES_KEY, value, userId));
  return value;
}
