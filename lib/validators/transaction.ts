import { z } from "zod";

export const transactionInputSchema = z.object({
  trackerId: z.string().min(1),
  accountName: z.string().trim().min(1).optional().nullable(),
  date: z.string().date(),
  amount: z.union([z.string(), z.number()]),
  direction: z.enum(["expense", "income"]),
  categoryId: z.string().trim().min(1, "Category is required"),
  payeeId: z.string().optional().nullable(),
  customPayeeName: z.string().trim().optional().nullable(),
  weightKg: z.union([z.string(), z.number()]).optional().nullable(),
  notes: z.string().trim().optional().nullable(),
  source: z.enum(["manual", "schedule"]).default("manual"),
  scheduleId: z.string().optional().nullable(),
});

export const transactionUpdateSchema = z
  .object({
    accountName: z.string().trim().min(1).optional(),
    date: z.string().date().optional(),
    amount: z.union([z.string(), z.number()]).optional(),
    direction: z.enum(["expense", "income"]).optional(),
    categoryId: z.string().trim().min(1).optional().nullable(),
    payeeId: z.string().optional().nullable(),
    customPayeeName: z.string().trim().optional().nullable(),
    weightKg: z.union([z.string(), z.number()]).optional().nullable(),
    notes: z.string().trim().optional().nullable(),
  })
  .strict();

export const transactionQuerySchema = z.object({
  trackerId: z.string().min(1),
  from: z.string().optional(),
  to: z.string().optional(),
  categoryId: z.string().optional(),
  payeeId: z.string().optional(),
  direction: z.enum(["expense", "income"]).optional(),
  q: z.string().optional(),
  page: z.coerce.number().int().positive().optional(),
});
