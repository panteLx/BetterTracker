import { z } from "zod";

export const scheduleInputSchema = z.object({
  trackerId: z.string().min(1),
  name: z.string().trim().min(1),
  amount: z.union([z.string(), z.number()]),
  direction: z.enum(["expense", "income"]),
  categoryId: z.string().optional().nullable(),
  payeeId: z.string().optional().nullable(),
  customPayeeName: z.string().trim().optional().nullable(),
  notesTemplate: z.string().trim().optional().nullable(),
  frequency: z.enum(["monthly", "yearly", "custom_days"]),
  intervalValue: z.coerce.number().int().positive(),
  nextDueDate: z.string().date(),
  isActive: z.boolean().optional(),
  autoCreateDisabled: z.boolean().optional(),
});
