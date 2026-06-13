import { z } from "zod";

export const transactionInputSchema = z.object({
  trackerId: z.string().min(1),
  accountName: z.string().trim().min(1).default("Hauptkonto"),
  date: z.string().date(),
  amount: z.union([z.string(), z.number()]),
  direction: z.enum(["expense", "income"]),
  categoryId: z.string().optional().nullable(),
  payeeId: z.string().optional().nullable(),
  customPayeeName: z.string().trim().optional().nullable(),
  notes: z.string().trim().optional().nullable(),
  source: z.enum(["manual", "schedule"]).default("manual"),
  scheduleId: z.string().optional().nullable(),
});

export const transactionQuerySchema = z.object({
  trackerId: z.string().min(1),
  from: z.string().optional(),
  to: z.string().optional(),
  categoryId: z.string().optional(),
  direction: z.enum(["expense", "income"]).optional(),
  q: z.string().optional(),
});
