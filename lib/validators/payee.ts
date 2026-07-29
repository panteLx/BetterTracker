import { z } from "zod";

export const payeeInputSchema = z
  .object({
    trackerId: z.string().min(1),
    name: z.string().trim().min(1),
    notes: z.string().trim().optional().nullable(),
  })
  .strict();

export const payeeUpdateSchema = z
  .object({
    name: z.string().trim().min(1).optional(),
    notes: z.string().trim().optional().nullable(),
    isActive: z.boolean().optional(),
  })
  .strict();
