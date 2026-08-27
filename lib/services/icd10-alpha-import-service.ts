import AdmZip from "adm-zip";
import { db } from "@/lib/db";
import { icd10AlphaTerms } from "@/lib/db/schema";
import { ValidationError } from "@/lib/errors";
import { decodeXmlEntities } from "@/lib/services/icd10-import-service";

/**
 * Imports the BfArM ICD-10-GM "Alphabetisches Verzeichnis" (ODT format) into
 * the icd10_alpha_terms lookup table, so the ICD-10 search also matches
 * everyday German diagnosis wording and synonyms, not just the technical
 * class titles from the Systematisches Verzeichnis (icd10-import-service.ts).
 *
 * Source: same BfArM download page as the Systematik (see that file's doc
 * comment), "Alphabetisches Verzeichnis" → ODT. Upload the outer zip
 * (icd10gm<year>alpha-odt.zip) as-is via the admin ICD-10 import page; this
 * importer opens the nested Klassifikationsdateien/*alphabet*.odt (itself a
 * zip, being an OpenDocument file) and reads its content.xml. The sibling
 * "tabneu" file in that folder (Tabelle der Neubildungen, the neoplasm
 * site/behavior grid) is a different, table-shaped document and is not
 * imported here — the placeholder section BfArM leaves for it in the
 * alphabet file ("Hier bitte Tabelle Neubildungen einfügen!", styled
 * "Titelbuchstabe") is skipped like any other non-entry paragraph.
 *
 * ODT structure (verified against the 2026 release): every dictionary entry
 * is one <text:p> paragraph. Depth is encoded purely by a run of "– "
 * (en dash + space) prefixes on the paragraph's own text — NOT by the
 * paragraph style name, which BfArM's export also reuses for page/column-
 * break continuation paragraphs (always recognizable by a literal
 * "(Forts.)" suffix). Those continuation paragraphs just re-print the
 * currently-open term path for print layout and carry no new information,
 * so they're skipped outright — the term-path stack built from the E1..E8
 * paragraphs already has the right state from before the break.
 *
 * Within a coded paragraph, the description and the trailing code(s) are
 * separated by exactly one <text:s/> (ODF's "run of whitespace" element,
 * used for the visual alignment gap before the code column — a single space
 * between words is just literal text, never <text:s/>). A line can carry
 * more than one code (dagger/asterisk double coding, e.g. "E85.0† N08.4*",
 * or a plain combination code, e.g. "C22.0 Q87.8") — one row is stored per
 * code, all sharing the same term text. The one non-code annotation found in
 * the source, "(nur Zusatzkode)", is filtered out by the code-shape check
 * rather than special-cased.
 */

const ODT_ENTRY_PATTERN = /^Klassifikationsdateien\/.*alphabet.*\.odt$/i;
const CONTENT_XML_ENTRY = "content.xml";
const PARAGRAPH_PATTERN = /<text:p([^>]*)>([\s\S]*?)<\/text:p>|<text:p([^>]*)\/>/g;
const TAG_PATTERN = /<[^>]+>/g;
const SPACER_PATTERN = /<text:s(?:\/>|\s[^>]*\/>)/;
const STYLE_NAME_PATTERN = /text:style-name="([^"]+)"/;
const CODE_PATTERN = /^[A-Z]\d{2}(\.[\dA-Z]{1,3})?!?$/;
const DASH_PREFIX = "– ";
const CONTINUATION_MARKER = "(Forts.)";
const LETTER_HEADER_STYLE = "Titelbuchstabe";
const INSERT_BATCH_SIZE = 500;

function loadAlphabetXml(zipBuffer: Buffer): string {
  let outerZip: AdmZip;
  try {
    outerZip = new AdmZip(zipBuffer);
  } catch {
    throw new ValidationError("Not a valid zip file");
  }
  const odtEntry = outerZip.getEntries().find((item) => ODT_ENTRY_PATTERN.test(item.entryName));
  if (!odtEntry) {
    throw new ValidationError(
      "No Alphabet ODT entry found (expected something under Klassifikationsdateien/*alphabet*.odt) — is this the Alphabet ODT zip?"
    );
  }

  let odtZip: AdmZip;
  try {
    odtZip = new AdmZip(odtEntry.getData());
  } catch {
    throw new ValidationError("The Alphabet ODT entry is not a valid ODT (zip) file");
  }
  const contentEntry = odtZip.getEntries().find((item) => item.entryName === CONTENT_XML_ENTRY);
  if (!contentEntry) {
    throw new ValidationError("The Alphabet ODT did not contain a content.xml");
  }
  return contentEntry.getData().toString("utf-8");
}

function plainText(innerXml: string): string {
  return decodeXmlEntities(innerXml.replace(TAG_PATTERN, "")).trim();
}

function depthAndText(rawText: string): { depth: number; text: string } {
  let depth = 0;
  let text = rawText;
  while (text.startsWith(DASH_PREFIX)) {
    depth++;
    text = text.slice(DASH_PREFIX.length);
  }
  return { depth, text: text.trim() };
}

type AlphaRow = { code: string; term: string };

function parseAlphabetXml(xml: string): AlphaRow[] {
  const rows: AlphaRow[] = [];
  const stack: string[] = [];

  for (const match of xml.matchAll(PARAGRAPH_PATTERN)) {
    const attrs = match[1] ?? match[3] ?? "";
    const inner = match[2];
    if (inner === undefined) continue; // self-closed paragraph, no content

    const styleName = STYLE_NAME_PATTERN.exec(attrs)?.[1];
    if (styleName === LETTER_HEADER_STYLE) continue; // A/B/C… section letter header

    if (inner.includes(CONTINUATION_MARKER)) continue; // page/column-break repeat, not new data

    const [descriptionRaw, ...codeRawParts] = inner.split(SPACER_PATTERN);
    const { depth, text } = depthAndText(plainText(descriptionRaw));
    if (!text) continue;

    stack[depth] = text;
    stack.length = depth + 1;

    if (codeRawParts.length === 0) continue; // grouping header, no code of its own

    const term = stack.slice(0, depth + 1).join(", ");
    const codeText = plainText(codeRawParts.join(""));
    for (const token of codeText.split(/\s+/)) {
      const bareCode = token.replace(/[†*]+$/, "");
      if (CODE_PATTERN.test(bareCode)) {
        rows.push({ code: bareCode, term });
      }
    }
  }

  return rows;
}

export type Icd10AlphaImportResult = { count: number; distinctCodes: number };

export async function importIcd10AlphaFromZip(zipBuffer: Buffer): Promise<Icd10AlphaImportResult> {
  const xml = loadAlphabetXml(zipBuffer);
  const rows = parseAlphabetXml(xml);
  if (rows.length === 0) {
    throw new ValidationError("Parsed 0 term entries from this file — refusing to wipe the existing table");
  }

  db.transaction((tx) => {
    tx.delete(icd10AlphaTerms).run();
    for (let i = 0; i < rows.length; i += INSERT_BATCH_SIZE) {
      const batch = rows.slice(i, i + INSERT_BATCH_SIZE);
      tx.insert(icd10AlphaTerms).values(batch).run();
    }
  });

  return { count: rows.length, distinctCodes: new Set(rows.map((row) => row.code)).size };
}
