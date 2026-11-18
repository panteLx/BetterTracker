import { z } from "zod";

export const invoiceTypeSchema = z.enum(["ambulant", "stationaer", "konsil"]);
export type InvoiceType = z.infer<typeof invoiceTypeSchema>;

// `caseFileIds` arrives as a JSON-encoded string in the multipart form.
export const invoiceUploadFieldsSchema = z
  .object({
    invoiceType: invoiceTypeSchema,
    caseFileIds: z.array(z.string().trim().min(1)).default([]),
  })
  .strict();

export const setInvoiceTypeSchema = z.object({ invoiceType: invoiceTypeSchema }).strict();
