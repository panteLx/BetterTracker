import { z } from "zod";

export { caseFileIdsInputSchema as pvsBatchInputSchema } from "@/lib/validators/case-file-bulk";

export const pvsBatchVisibilityInputSchema = z
  .object({
    isHidden: z.boolean(),
  })
  .strict();
