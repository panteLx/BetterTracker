import { z } from "zod";

export const caseFileCommentInputSchema = z
  .object({
    body: z.string().trim().min(1),
  })
  .strict();
