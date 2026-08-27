import { and, asc, count, desc, inArray, like, or } from "drizzle-orm";
import { db } from "@/lib/db";
import { icd10AlphaTerms, icd10Codes } from "@/lib/db/schema";

const MIN_QUERY_LENGTH = 2;
const MAX_RESULTS = 25;
const ALPHA_MATCH_LIMIT = 100;

const COMPOUND_MIN_PART_LENGTH = 4;
const COMPOUND_GLUE_OFFSETS = [0, 1, 2]; // absorbs German Fugenelemente (linking letters) at the split point
const COMPOUND_MAX_SPLITS = 60;

type Icd10SearchResult = { code: string; title: string; groupTitle: string | null };

/**
 * German lay compounds (e.g. "Leistenhernie") often aren't a single entry in
 * the Alphabet — BfArM indexes it inverted and split, e.g. "Leiste, Hernie".
 * A plain `LIKE '%Leistenhernie%'` then finds nothing. This builds a set of
 * (left, right) substring pairs by splitting the query at every plausible
 * point, trying a few "glue" offsets right at the cut to absorb the linking
 * letter(s) German compounding inserts (Leist-en-hernie). Both halves must
 * appear somewhere in the term, in either order, which is order-independent
 * by construction since it's an AND of two unanchored LIKEs.
 */
function compoundSplitConditions(word: string) {
  const conditions = [];
  for (let i = COMPOUND_MIN_PART_LENGTH; i <= word.length - COMPOUND_MIN_PART_LENGTH; i++) {
    const left = word.slice(0, i);
    for (const glue of COMPOUND_GLUE_OFFSETS) {
      const right = word.slice(i + glue);
      if (right.length < COMPOUND_MIN_PART_LENGTH) continue;
      conditions.push(and(like(icd10AlphaTerms.term, `%${left}%`), like(icd10AlphaTerms.term, `%${right}%`)));
      if (conditions.length >= COMPOUND_MAX_SPLITS) return conditions;
    }
  }
  return conditions;
}

/**
 * Searches both the Systematik (official, often Latin/technical class
 * titles) and the Alphabet (German lay-term synonyms) lookups, merged by
 * code. A code whose *title* matched keeps its canonical text (that's what
 * matched). A code reached only through an Alphabet synonym shows that
 * synonym as the title instead — showing the canonical title there would
 * silently swap out the German wording the query actually matched, which is
 * the whole point of importing the Alphabet in the first place — with the
 * canonical block/chapter name attached as groupTitle when available for
 * context. A code that only exists in the Alphabet import (e.g. excluded
 * from the ambulant-billing Systematik subset) has no groupTitle at all.
 */
export async function searchIcd10Codes(query: string): Promise<Icd10SearchResult[]> {
  const trimmed = query.trim();
  if (trimmed.length < MIN_QUERY_LENGTH) return [];

  const [systematicRows, alphaRows] = await Promise.all([
    db
      .select({ code: icd10Codes.code, title: icd10Codes.title, groupTitle: icd10Codes.groupTitle })
      .from(icd10Codes)
      .where(or(like(icd10Codes.title, `%${trimmed}%`), like(icd10Codes.code, `${trimmed}%`)))
      .orderBy(asc(icd10Codes.code))
      .limit(MAX_RESULTS),
    db
      .select({ code: icd10AlphaTerms.code, term: icd10AlphaTerms.term })
      .from(icd10AlphaTerms)
      .where(like(icd10AlphaTerms.term, `%${trimmed}%`))
      .orderBy(asc(icd10AlphaTerms.code))
      .limit(ALPHA_MATCH_LIMIT),
  ]);

  let effectiveAlphaRows = alphaRows;
  if (effectiveAlphaRows.length === 0 && !/\s/.test(trimmed) && trimmed.length >= COMPOUND_MIN_PART_LENGTH * 2) {
    const splitConditions = compoundSplitConditions(trimmed);
    if (splitConditions.length > 0) {
      effectiveAlphaRows = await db
        .select({ code: icd10AlphaTerms.code, term: icd10AlphaTerms.term })
        .from(icd10AlphaTerms)
        .where(or(...splitConditions))
        .orderBy(asc(icd10AlphaTerms.code))
        .limit(ALPHA_MATCH_LIMIT);
    }
  }

  const byCode = new Map<string, Icd10SearchResult>();
  for (const row of systematicRows) byCode.set(row.code, row);

  const alphaOnlyCodes = [...new Set(effectiveAlphaRows.map((row) => row.code))].filter((code) => !byCode.has(code));
  const groupTitleByCode = new Map<string, string | null>();
  if (alphaOnlyCodes.length > 0) {
    const canonicalRows = await db
      .select({ code: icd10Codes.code, groupTitle: icd10Codes.groupTitle })
      .from(icd10Codes)
      .where(inArray(icd10Codes.code, alphaOnlyCodes));
    for (const row of canonicalRows) groupTitleByCode.set(row.code, row.groupTitle);
  }
  for (const row of effectiveAlphaRows) {
    if (byCode.has(row.code)) continue;
    byCode.set(row.code, { code: row.code, title: row.term, groupTitle: groupTitleByCode.get(row.code) ?? null });
  }

  return [...byCode.values()].sort((a, b) => a.code.localeCompare(b.code)).slice(0, MAX_RESULTS);
}

export async function getIcd10ImportStatus() {
  const [countRow] = await db.select({ value: count() }).from(icd10Codes);
  const [latest] = await db
    .select({ updatedAt: icd10Codes.updatedAt })
    .from(icd10Codes)
    .orderBy(desc(icd10Codes.updatedAt))
    .limit(1);

  return {
    count: countRow?.value ?? 0,
    lastImportedAt: latest?.updatedAt ?? null,
  };
}

export async function getIcd10AlphaImportStatus() {
  const [countRow] = await db.select({ value: count() }).from(icd10AlphaTerms);
  const [latest] = await db
    .select({ updatedAt: icd10AlphaTerms.updatedAt })
    .from(icd10AlphaTerms)
    .orderBy(desc(icd10AlphaTerms.updatedAt))
    .limit(1);

  return {
    count: countRow?.value ?? 0,
    lastImportedAt: latest?.updatedAt ?? null,
  };
}
