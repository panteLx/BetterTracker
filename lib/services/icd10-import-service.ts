import AdmZip from "adm-zip";
import { XMLParser } from "fast-xml-parser";
import { db } from "@/lib/db";
import { icd10Codes } from "@/lib/db/schema";
import { ValidationError } from "@/lib/errors";

/**
 * Imports the BfArM ICD-10-GM "Systematisches Verzeichnis" (ClaML/XML format)
 * into the icd10_codes lookup table, restricted to codes usable for ambulant
 * billing (Sprechstunde/AOP/Notfallbehandlung, §295 SGB V).
 *
 * Source: https://www.bfarm.de/DE/Kodiersysteme/Services/Downloads/_node.html
 * (ICD-10-GM <year> → Systematisches Verzeichnis → ClaML/XML). Free, no
 * login, but gated behind a usage-terms confirmation — download it yourself
 * and upload the zip via the admin ICD-10 import page.
 *
 * Only the ClaML <Meta name="Para295"> field is used for filtering (P/O/Z =
 * usable, V = not usable in the ambulant/§295 context). §301 (stationary
 * billing) is intentionally ignored — this app's Cases module only covers
 * outpatient consultation, AOP, and emergency treatment. See the
 * "Hinweise für die Datenübernahme..." section of the zip's
 * icd10gm<year>syst_claml_liesmich.txt for the exact BfArM-documented rules
 * this importer implements (terminal-code inheritance, V→P override on
 * combined codes).
 *
 * The BfArM PDF, not this import, is the binding reference (Referenzfassung)
 * — this is a convenience lookup, not a certified encoder.
 */

const XML_ENTRY_PATTERN = /^Klassifikationsdateien\/.*\.xml$/i;
const INSERT_BATCH_SIZE = 500;

type RawMeta = { "@_name": string; "@_value": string };
type RawLabel = string | { "#text"?: string; [key: string]: unknown } | RawLabel[];
type RawRubric = { "@_kind": string; Label?: RawLabel };
type RawCodeRef = { "@_code": string } | { "@_code": string }[];
type RawClass = {
  "@_code": string;
  "@_kind": string;
  Meta?: RawMeta[];
  SuperClass?: RawCodeRef;
  ModifiedBy?: { "@_code": string }[];
  Rubric?: RawRubric[];
};
type RawModifierClass = {
  "@_code": string;
  "@_modifier": string;
  Rubric?: RawRubric[];
};
type ClaMLDoc = {
  ClaML: {
    Class: RawClass[];
    Modifier?: unknown[];
    ModifierClass?: RawModifierClass[];
  };
};

/**
 * fast-xml-parser leaves numeric character references (e.g. `&#160;`, used
 * throughout the ClaML source for non-breaking spaces) undecoded in text
 * content. Decode them here and fold the resulting NBSPs to regular spaces
 * so substring search isn't defeated by an invisible character mismatch.
 */
export function decodeXmlEntities(text: string): string {
  return text
    .replace(/&#(\d+);/g, (_, dec: string) => String.fromCodePoint(Number(dec)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex: string) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/\u00A0/g, " ");
}

function labelText(label: RawLabel | undefined): string {
  if (label == null) return "";
  if (typeof label === "string") return label.trim();
  if (Array.isArray(label)) return label.map(labelText).join(" ").trim();
  if (typeof label["#text"] === "string") return label["#text"].trim();
  return Object.entries(label)
    .filter(([key]) => !key.startsWith("@_"))
    .map(([, value]) => labelText(value as RawLabel))
    .join(" ")
    .trim();
}

function preferredLabel(rubrics: RawRubric[] | undefined, kind = "preferred"): string {
  const rubric = rubrics?.find((entry) => entry["@_kind"] === kind);
  return rubric ? decodeXmlEntities(labelText(rubric.Label)) : "";
}

function metaValue(metas: RawMeta[] | undefined, name: string): string | undefined {
  return metas?.find((entry) => entry["@_name"] === name)?.["@_value"];
}

function firstRefCode(ref: RawCodeRef | undefined): string | undefined {
  if (!ref) return undefined;
  return Array.isArray(ref) ? ref[0]?.["@_code"] : ref["@_code"];
}

type ModifierOption = { digit: string; label: string };
type Combo = { suffix: string; labelParts: string[] };

/** Cartesian product across a class's ModifiedBy list, in document order (4th digit before 5th, etc.). */
function combineModifiers(
  modifierCodes: string[],
  optionsByModifier: Map<string, ModifierOption[]>
): Combo[] {
  let combos: Combo[] = [{ suffix: "", labelParts: [] }];
  for (const modifierCode of modifierCodes) {
    const options = optionsByModifier.get(modifierCode) ?? [];
    const next: Combo[] = [];
    for (const combo of combos) {
      for (const option of options) {
        next.push({
          suffix: combo.suffix + option.digit,
          labelParts: [...combo.labelParts, option.label],
        });
      }
    }
    combos = next;
  }
  return combos;
}

function loadClamlXml(zipBuffer: Buffer): string {
  let zip: AdmZip;
  try {
    zip = new AdmZip(zipBuffer);
  } catch {
    throw new ValidationError("Not a valid zip file");
  }
  const entry = zip.getEntries().find((item) => XML_ENTRY_PATTERN.test(item.entryName));
  if (!entry) {
    throw new ValidationError(
      "No ClaML XML entry found (expected something under Klassifikationsdateien/*.xml) — is this the Systematik ClaML/XML zip?"
    );
  }
  return entry.getData().toString("utf-8");
}

function buildRows(doc: ClaMLDoc) {
  const classes = doc.ClaML?.Class ?? [];
  const modifierClasses = doc.ClaML?.ModifierClass ?? [];

  const blockTitleByCode = new Map<string, string>();
  const kindByCode = new Map<string, string>();
  const superClassByCode = new Map<string, string>();
  for (const cls of classes) {
    kindByCode.set(cls["@_code"], cls["@_kind"]);
    const superClassCode = firstRefCode(cls.SuperClass);
    if (superClassCode) superClassByCode.set(cls["@_code"], superClassCode);
    if (cls["@_kind"] === "block") {
      blockTitleByCode.set(cls["@_code"], preferredLabel(cls.Rubric));
    }
  }

  /** Category codes nest under other categories (K40.0 under K40) before
   * reaching their block (K40-K46) — walk up until a block is found. */
  function resolveGroupTitle(code: string): string | null {
    let current = superClassByCode.get(code);
    for (let guard = 0; current && guard < 10; guard++) {
      if (kindByCode.get(current) === "block") {
        return blockTitleByCode.get(current) ?? null;
      }
      current = superClassByCode.get(current);
    }
    return null;
  }

  const optionsByModifier = new Map<string, ModifierOption[]>();
  for (const modifierClass of modifierClasses) {
    const label = preferredLabel(modifierClass.Rubric);
    if (!label) continue;
    const list = optionsByModifier.get(modifierClass["@_modifier"]) ?? [];
    list.push({ digit: modifierClass["@_code"], label });
    optionsByModifier.set(modifierClass["@_modifier"], list);
  }
  for (const list of optionsByModifier.values()) {
    list.sort((a, b) => a.digit.localeCompare(b.digit));
  }

  const rows = new Map<string, { code: string; title: string; groupTitle: string | null }>();
  let skippedNotAmbulant = 0;

  for (const cls of classes) {
    if (cls["@_kind"] !== "category") continue;
    const code = cls["@_code"];
    const title = preferredLabel(cls.Rubric);
    if (!title) continue;

    const groupTitle = resolveGroupTitle(code);
    const para295 = metaValue(cls.Meta, "Para295");
    const modifierCodes = (cls.ModifiedBy ?? []).map((entry) => entry["@_code"]);

    if (para295 && para295 !== "V") {
      rows.set(code, { code, title, groupTitle });
    } else {
      skippedNotAmbulant++;
    }

    if (modifierCodes.length > 0) {
      for (const combo of combineModifiers(modifierCodes, optionsByModifier)) {
        if (combo.labelParts.length !== modifierCodes.length) continue; // an unresolved modifier catalog
        // Modifier codes already carry the "." when one is needed (e.g. ".0" for
        // the digit right after a bare 3-character code); never insert our own.
        const combinedCode = `${code}${combo.suffix}`;
        const combinedTitle = `${title}, ${combo.labelParts.join(", ")}`;
        rows.set(combinedCode, { code: combinedCode, title: combinedTitle, groupTitle });
      }
    }
  }

  return { rows: [...rows.values()], skippedNotAmbulant };
}

export type Icd10ImportResult = { count: number; skippedNotAmbulant: number };

export async function importIcd10FromZip(zipBuffer: Buffer): Promise<Icd10ImportResult> {
  const xml = loadClamlXml(zipBuffer);

  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
    textNodeName: "#text",
    isArray: (name) => ["Class", "ModifierClass", "Meta", "Rubric", "ModifiedBy"].includes(name),
  });
  const doc = parser.parse(xml) as ClaMLDoc;

  if (!doc.ClaML?.Class?.length) {
    throw new ValidationError("XML entry did not contain any ClaML <Class> elements");
  }

  const { rows, skippedNotAmbulant } = buildRows(doc);
  if (rows.length === 0) {
    throw new ValidationError("Parsed 0 ambulant-usable codes from this file — refusing to wipe the existing table");
  }

  db.transaction((tx) => {
    tx.delete(icd10Codes).run();
    for (let i = 0; i < rows.length; i += INSERT_BATCH_SIZE) {
      const batch = rows.slice(i, i + INSERT_BATCH_SIZE);
      tx.insert(icd10Codes).values(batch).run();
    }
  });

  return { count: rows.length, skippedNotAmbulant };
}
