import fs from "fs/promises";
import path from "path";
import { env } from "@/lib/env";

const rawPath = env.databaseUrl.replace(/^file:/, "");
const dbPath = path.isAbsolute(rawPath)
  ? rawPath
  : path.join(/* turbopackIgnore: true */ process.cwd(), rawPath);
const baseDir = path.join(path.dirname(dbPath), "invoices");

// Ids are server-generated UUIDs; reject anything else so a path can never escape baseDir.
const SAFE_ID = /^[A-Za-z0-9-]+$/;

export function invoiceFilePath(workspaceId: string, invoiceId: string) {
  if (!SAFE_ID.test(workspaceId) || !SAFE_ID.test(invoiceId)) {
    throw new Error("Invalid invoice file identifier");
  }
  return path.join(baseDir, workspaceId, `${invoiceId}.pdf`);
}

export async function saveInvoiceFile(workspaceId: string, invoiceId: string, bytes: Buffer) {
  const target = invoiceFilePath(workspaceId, invoiceId);
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, bytes);
}

export async function readInvoiceFile(workspaceId: string, invoiceId: string) {
  try {
    return await fs.readFile(invoiceFilePath(workspaceId, invoiceId));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}

export async function deleteInvoiceFile(workspaceId: string, invoiceId: string) {
  await fs.rm(invoiceFilePath(workspaceId, invoiceId), { force: true });
}
