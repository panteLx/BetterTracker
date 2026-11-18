import { renderToBuffer } from "@react-pdf/renderer";
import { PathologyListDocument } from "@/lib/services/pdf/pathology-list-document";
import type { PathologyEntry, PathologyListSummary } from "@/lib/services/pathology-service";

export async function renderPathologyListPdf(
  list: PathologyListSummary & { entries: PathologyEntry[] }
) {
  return renderToBuffer(PathologyListDocument({ list }));
}
