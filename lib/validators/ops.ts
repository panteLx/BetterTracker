import { z } from "zod";

export const opsSearchQuerySchema = z.object({
  q: z.string().trim().max(100).default(""),
});

const code = z.string().trim().regex(/^\d{1,10}$/);

export const opsFixedCodesSchema = z
  .object({
    letterPost: code,
    letterFax: code,
    flatUnder60: code,
    flatFrom60: code,
  })
  .strict();
