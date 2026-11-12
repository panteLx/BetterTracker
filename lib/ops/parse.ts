import { readSheet } from "read-excel-file/node";
import { ValidationError } from "@/lib/errors";

export type OpsEntry = {
  opsCode: string;
  description: string;
  operation: string | null;
  monitoring: string | null;
  anesthesia: string | null;
  funding: string | null;
  hygiene: string | null;
  aop115b: boolean;
};

export type HybridEntry = { opsCode: string; description: string };

type Matcher = { label: string; test: (header: string) => boolean };

const exact = (label: string): Matcher => ({ label, test: (h) => h === label.toLowerCase() });
const OPS_CODE: Matcher = { label: "OPS 2026", test: (h) => /^ops \d{4}$/.test(h) };

const ANHANG2_COLUMNS = {
  opsCode: OPS_CODE,
  description: { label: "Bezeichnung OPS 2026", test: (h: string) => /^bezeichnung ops/.test(h) },
  operation: exact("ambulante Operation"),
  monitoring: exact("Überwachungs-komplex ambulant"),
  anesthesia: exact("ambulante Anästhesie"),
  funding: exact("Zuschlag Förderung"),
  aop115b: exact("§115b"),
  hygiene: exact("Zuschlag für den zusätzlichen Hygieneaufwand"),
} satisfies Record<string, Matcher>;

const HYBRID_COLUMNS = {
  opsCode: OPS_CODE,
  description: { label: "OPS-Bezeichnung 2026", test: (h: string) => /^ops-bezeichnung/.test(h) },
} satisfies Record<string, Matcher>;

const normalizeHeader = (v: unknown) =>
  String(v ?? "").replace(/\s+/g, " ").trim().toLowerCase();

const cell = (v: unknown): string | null => {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s === "" ? null : s;
};

async function readRows(bytes: Buffer): Promise<unknown[][]> {
  try {
    return (await readSheet(bytes)) as unknown[][];
  } catch {
    throw new ValidationError("File is not a readable .xlsx spreadsheet");
  }
}

function resolveColumns<K extends string>(
  rows: unknown[][],
  columns: Record<K, Matcher>
): { headerIndex: number; index: Record<K, number> } {
  const keys = Object.keys(columns) as K[];
  let best: { headerIndex: number; index: Partial<Record<K, number>>; missing: K[] } | null = null;

  for (let r = 0; r < Math.min(rows.length, 10); r++) {
    const headers = rows[r].map(normalizeHeader);
    const index: Partial<Record<K, number>> = {};
    for (const key of keys) {
      const found = headers.findIndex((h) => columns[key].test(h));
      if (found >= 0) index[key] = found;
    }
    const missing = keys.filter((k) => index[k] === undefined);
    if (!best || missing.length < best.missing.length) best = { headerIndex: r, index, missing };
    if (missing.length === 0) break;
  }

  if (!best || best.missing.length > 0) {
    const names = (best?.missing ?? keys).map((k) => columns[k].label).join(", ");
    throw new ValidationError(`Missing required column(s): ${names}`);
  }
  return { headerIndex: best.headerIndex, index: best.index as Record<K, number> };
}

export async function parseAnhang2(bytes: Buffer): Promise<OpsEntry[]> {
  const rows = await readRows(bytes);
  const { headerIndex, index } = resolveColumns(rows, ANHANG2_COLUMNS);
  const byCode = new Map<string, OpsEntry>();

  for (const row of rows.slice(headerIndex + 1)) {
    const opsCode = cell(row[index.opsCode]);
    if (!opsCode) continue;
    byCode.set(opsCode, {
      opsCode,
      description: cell(row[index.description]) ?? "",
      operation: cell(row[index.operation]),
      monitoring: cell(row[index.monitoring]),
      anesthesia: cell(row[index.anesthesia]),
      funding: cell(row[index.funding]),
      hygiene: cell(row[index.hygiene]),
      aop115b: cell(row[index.aop115b])?.toLowerCase() === "ja",
    });
  }

  if (byCode.size === 0) throw new ValidationError("File contains no data rows");
  return [...byCode.values()];
}

export async function parseHybridList(bytes: Buffer): Promise<HybridEntry[]> {
  const rows = await readRows(bytes);
  const { headerIndex, index } = resolveColumns(rows, HYBRID_COLUMNS);
  const byCode = new Map<string, HybridEntry>();

  for (const row of rows.slice(headerIndex + 1)) {
    const opsCode = cell(row[index.opsCode]);
    if (!opsCode) continue;
    byCode.set(opsCode, { opsCode, description: cell(row[index.description]) ?? "" });
  }

  if (byCode.size === 0) throw new ValidationError("File contains no data rows");
  return [...byCode.values()];
}
