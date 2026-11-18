import type { PDFPageProxy } from "pdfjs-dist/legacy/build/pdf.mjs";
import { isHttpError, ValidationError } from "@/lib/errors";

export type ParsedPathologyEntry = {
  sampleNumber: string;
  patientName: string;
  dateOfBirth: string | null;
  receivedDate: string | null;
  liquid: string | null;
  sender: string | null;
  material: string | null;
  isCancerRegistry: boolean;
};

export type ParsedPathologyList = {
  periodStart: string | null;
  periodEnd: string | null;
  entries: ParsedPathologyEntry[];
};

const MAX_PAGES = 20;
const SAMPLE_NUMBER = /^[A-Z]{1,3}\s\d{4}\s\d{4,}$/;
const CANCER_TEXT = /Kasse\s*\+\s*Vers-?Nr|Krebsregister/i;
const COLUMN_PAD = 3;
const ROW_TOP_TOLERANCE = 3;
const ROW_MAX_DROP = 28;

type TextItem = { str: string; x: number; y: number };
type Rect = { x1: number; y1: number; x2: number; y2: number; fill: string | null };
type Matrix = [number, number, number, number, number, number];

const COLUMNS = ["Proben-Nr", "Patient", "Eingang", "Liq", "Einsender", "Material"] as const;
type Column = (typeof COLUMNS)[number];
type Header = { left: Record<Column, number>; materialRight: number; headerY: number };

type Pdfjs = typeof import("pdfjs-dist/legacy/build/pdf.mjs");
let pdfjsPromise: Promise<Pdfjs> | null = null;

// pdfjs touches these globals while loading; text extraction never uses them, and the
// optional canvas package that normally provides them is missing in slim images.
function loadPdfjs() {
  const scope = globalThis as Record<string, unknown>;
  for (const name of ["DOMMatrix", "ImageData", "Path2D"]) {
    if (typeof scope[name] === "undefined") scope[name] = class {};
  }
  return (pdfjsPromise ??= import("pdfjs-dist/legacy/build/pdf.mjs"));
}

function multiply(m: Matrix, n: Matrix): Matrix {
  return [
    m[0] * n[0] + m[2] * n[1],
    m[1] * n[0] + m[3] * n[1],
    m[0] * n[2] + m[2] * n[3],
    m[1] * n[2] + m[3] * n[3],
    m[0] * n[4] + m[2] * n[5] + m[4],
    m[1] * n[4] + m[3] * n[5] + m[5],
  ];
}

function isoFromGerman(day: string, month: string, year: string) {
  const iso = `${year}-${month}-${day}`;
  const date = new Date(`${iso}T00:00:00Z`);
  return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== iso ? null : iso;
}

// Warm fill (the lab marks cancer-registry rows orange/red).
function isWarmFill(fill: string | null) {
  const match = fill?.match(/^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i);
  if (!match) return false;
  const [r, g, b] = [match[1], match[2], match[3]].map((hex) => parseInt(hex, 16));
  return r >= 0xd0 && g <= 0xa0 && b <= 0x80;
}

async function readRects(page: PDFPageProxy, OPS: Pdfjs["OPS"]) {
  const list = await page.getOperatorList();
  const rects: Rect[] = [];
  let ctm: Matrix = [1, 0, 0, 1, 0, 0];
  const stack: Matrix[] = [];
  let fill: string | null = null;

  for (let i = 0; i < list.fnArray.length; i++) {
    const fn = list.fnArray[i];
    const args = list.argsArray[i];
    if (fn === OPS.save) stack.push(ctm);
    else if (fn === OPS.restore) ctm = stack.pop() ?? ctm;
    else if (fn === OPS.transform) ctm = multiply(ctm, args as Matrix);
    else if (fn === OPS.setFillRGBColor) fill = String(args[0]);
    else if (fn === OPS.constructPath && args[2]) {
      const [minX, minY, maxX, maxY] = Array.from(args[2] as ArrayLike<number>);
      const xs = [minX, maxX].flatMap((x) => [minY, maxY].map((y) => ctm[0] * x + ctm[2] * y + ctm[4]));
      const ys = [minX, maxX].flatMap((x) => [minY, maxY].map((y) => ctm[1] * x + ctm[3] * y + ctm[5]));
      rects.push({
        x1: Math.min(...xs),
        x2: Math.max(...xs),
        y1: Math.min(...ys),
        y2: Math.max(...ys),
        fill,
      });
    }
  }
  return rects;
}

function loadDoc(pdfjs: Pdfjs, bytes: Uint8Array) {
  return pdfjs.getDocument({
    data: bytes,
    useSystemFonts: true,
    isEvalSupported: false,
    verbosity: 0,
  }).promise;
}

function findHeader(items: TextItem[], rects: Rect[]): Header | null {
  const left: Partial<Record<Column, number>> = {};
  let headerY = 0;
  for (const column of COLUMNS) {
    const hit = items.find((item) => item.str.trim() === column);
    if (!hit) return null;
    left[column] = hit.x;
    headerY = hit.y;
  }

  const materialX = left.Material!;
  const cells = rects
    .filter(
      (rect) =>
        rect.x1 <= materialX + 1 &&
        rect.x2 >= materialX + 1 &&
        rect.y1 <= headerY + 3 &&
        rect.y2 >= headerY + 3
    )
    .sort((a, b) => (a.x2 - a.x1) * (a.y2 - a.y1) - (b.x2 - b.x1) * (b.y2 - b.y1));

  return {
    left: left as Record<Column, number>,
    materialRight: cells[0]?.x2 ?? Number.POSITIVE_INFINITY,
    headerY,
  };
}

function columnOf(header: Header, x: number): Column | null {
  const bounds = COLUMNS.map((column, index) => ({
    column,
    from: header.left[column] - COLUMN_PAD,
    to:
      index + 1 < COLUMNS.length
        ? header.left[COLUMNS[index + 1]] - COLUMN_PAD
        : header.materialRight,
  }));
  return bounds.find((bound) => x >= bound.from && x < bound.to)?.column ?? null;
}

function joinCell(items: TextItem[]) {
  const sorted = [...items].sort((a, b) => b.y - a.y || a.x - b.x);
  const lines: TextItem[][] = [];
  for (const item of sorted) {
    const line = lines.find((candidate) => Math.abs(candidate[0].y - item.y) <= 2);
    if (line) line.push(item);
    else lines.push([item]);
  }
  return lines
    .map((line) => line.sort((a, b) => a.x - b.x).map((item) => item.str.trim()).join(" "))
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

function parsePage(items: TextItem[], rects: Rect[], header: Header): ParsedPathologyEntry[] {
  const starts = items
    .filter(
      (item) =>
        columnOf(header, item.x) === "Proben-Nr" &&
        item.y < header.headerY &&
        SAMPLE_NUMBER.test(item.str.trim().replace(/\s+/g, " "))
    )
    .sort((a, b) => b.y - a.y);

  const warm = rects.filter((rect) => isWarmFill(rect.fill));

  return starts.map((start, index) => {
    const top = start.y + ROW_TOP_TOLERANCE;
    const bottom = Math.max(
      starts[index + 1] ? starts[index + 1].y + ROW_TOP_TOLERANCE : Number.NEGATIVE_INFINITY,
      start.y - ROW_MAX_DROP
    );
    const rowItems = items.filter(
      (item) => item.y <= top && item.y > bottom && !/^Rot-markierte/.test(item.str.trim())
    );

    const cells: Record<Column, TextItem[]> = {
      "Proben-Nr": [],
      Patient: [],
      Eingang: [],
      Liq: [],
      Einsender: [],
      Material: [],
    };
    for (const item of rowItems) {
      const column = columnOf(header, item.x);
      if (column) cells[column].push(item);
    }

    const patient = joinCell(cells.Patient);
    const dob = patient.match(/^(.*?)\s*\*\s*(\d{2})\.(\d{2})\.(\d{4})\s*$/);
    const received = joinCell(cells.Eingang).match(/(\d{2})\.(\d{2})\.(\d{4})/);

    const warmBand = warm.some((rect) => start.y >= rect.y1 - 1 && start.y <= rect.y2 + 1);
    const flagged = CANCER_TEXT.test(rowItems.map((item) => item.str).join(" "));
    const orNull = (value: string) => (value ? value : null);

    return {
      sampleNumber: start.str.trim().replace(/\s+/g, " "),
      patientName: dob ? dob[1].trim() : patient,
      dateOfBirth: dob ? isoFromGerman(dob[2], dob[3], dob[4]) : null,
      receivedDate: received ? isoFromGerman(received[1], received[2], received[3]) : null,
      liquid: orNull(joinCell(cells.Liq)),
      sender: orNull(joinCell(cells.Einsender)),
      material: orNull(joinCell(cells.Material)),
      isCancerRegistry: warmBand || flagged,
    };
  });
}

export async function parsePathologyPdf(bytes: Uint8Array): Promise<ParsedPathologyList> {
  try {
    const pdfjs = await loadPdfjs();
    const doc = await loadDoc(pdfjs, bytes);
    if (doc.numPages > MAX_PAGES) {
      throw new ValidationError(`PDF has more than ${MAX_PAGES} pages`);
    }
    let header: Header | null = null;
    let period: [string | null, string | null] = [null, null];
    const entries: ParsedPathologyEntry[] = [];

    for (let pageNumber = 1; pageNumber <= doc.numPages; pageNumber++) {
      const page = await doc.getPage(pageNumber);
      const content = await page.getTextContent();
      const items: TextItem[] = content.items.flatMap((item) =>
        "str" in item && item.str.trim()
          ? [{ str: item.str, x: item.transform[4], y: item.transform[5] }]
          : []
      );
      const rects = await readRects(page, pdfjs.OPS);

      if (pageNumber === 1) {
        const text = items.map((item) => item.str).join(" ");
        const match = text.match(
          /Zeitraum\s+(\d{2})\.(\d{2})\.(\d{4})\s+bis\s+(\d{2})\.(\d{2})\.(\d{4})/
        );
        if (match) {
          period = [
            isoFromGerman(match[1], match[2], match[3]),
            isoFromGerman(match[4], match[5], match[6]),
          ];
        }
      }

      const own = findHeader(items, rects);
      if (own) header = own;
      if (!header) {
        if (pageNumber === 1) throw new Error("no header");
        continue;
      }
      // A header-less continuation page reuses the columns but has no header line.
      entries.push(
        ...parsePage(items, rects, own ? header : { ...header, headerY: Number.POSITIVE_INFINITY })
      );
    }

    return { periodStart: period[0], periodEnd: period[1], entries };
  } catch (error) {
    if (isHttpError(error)) throw error;
    throw new ValidationError("Could not read the PDF");
  }
}
