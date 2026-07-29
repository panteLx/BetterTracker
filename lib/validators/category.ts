import { z } from "zod";

export const categoryInputSchema = z
  .object({
    trackerId: z.string().min(1),
    name: z.string().trim().min(1),
    type: z.enum(["expense", "income", "transfer"]).optional(),
    color: z.string().trim().min(1).optional(),
  })
  .strict();

export const categoryUpdateSchema = z
  .object({
    name: z.string().trim().min(1).optional(),
    type: z.enum(["expense", "income", "transfer"]).optional(),
    color: z.string().trim().min(1).optional(),
    isActive: z.boolean().optional(),
  })
  .strict();
