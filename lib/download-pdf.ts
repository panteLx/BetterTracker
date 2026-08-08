import { FetchError } from "@/lib/client-fetch";

/**
 * POSTs to a PDF-export endpoint and triggers a browser download of the
 * response. Not routed through fetchJson, which always expects a JSON body.
 */
export async function downloadPdfExport(
  url: string,
  body: unknown,
  fallbackFilename: string
) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({ error: "Request failed" }));
    throw new FetchError(data.error || "Request failed", response.status);
  }

  const blob = await response.blob();
  const disposition = response.headers.get("Content-Disposition") || "";
  const filename = /filename="([^"]+)"/.exec(disposition)?.[1] || fallbackFilename;

  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(objectUrl);
}
