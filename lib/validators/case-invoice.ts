import { z } from "zod";

// `caseFileIds` arrives as a JSON-encoded string in the multipart form.
export const invoiceUploadFieldsSchema = z
  .object({
    caseFileIds: z.array(z.string().trim().min(1)).default([]),
  })
  .strict();
