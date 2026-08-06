import { z } from "zod";

export const caseFileIdsInputSchema = z
  .object({
    caseFileIds: z.array(z.string().trim().min(1)).min(1),
  })
  .strict();
