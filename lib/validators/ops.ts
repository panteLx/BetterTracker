import { z } from "zod";

export const opsSearchQuerySchema = z.object({
  q: z.string().trim().max(100).default(""),
  hideHybrid: z.enum(["1", "0"]).default("0"),
  hideNo115b: z.enum(["1", "0"]).default("0"),
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
