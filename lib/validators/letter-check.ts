import { z } from "zod";

export const isoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date");

export const letterCheckRangeSchema = z.object({ from: isoDateSchema, to: isoDateSchema });

export const letterCheckUpdateSchema = z.object({ checked: z.boolean() }).strict();
