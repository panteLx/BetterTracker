import { z } from "zod";

const scheduleBaseSchema = {
  name: z.string().trim().min(1),
  amount: z.union([z.string(), z.number()]),
  direction: z.enum(["expense", "income"]),
  categoryId: z.string().trim().min(1, "Category is required"),
  payeeId: z.string().trim().min(1, "Payee is required"),
  notesTemplate: z.string().trim().optional().nullable(),
  frequency: z.enum(["monthly", "yearly", "custom_days"]),
  intervalValue: z.coerce.number().int().positive(),
  nextDueDate: z.string().date(),
};

export const scheduleInputSchema = z
  .object({
    trackerId: z.string().min(1),
    ...scheduleBaseSchema,
    isActive: z.boolean().optional(),
  })
  .strict();

export const scheduleUpdateSchema = z
  .object({
    name: scheduleBaseSchema.name.optional(),
    amount: scheduleBaseSchema.amount.optional(),
    direction: scheduleBaseSchema.direction.optional(),
    categoryId: scheduleBaseSchema.categoryId.optional(),
    payeeId: scheduleBaseSchema.payeeId.optional(),
    notesTemplate: scheduleBaseSchema.notesTemplate,
    frequency: scheduleBaseSchema.frequency.optional(),
    intervalValue: scheduleBaseSchema.intervalValue.optional(),
    nextDueDate: scheduleBaseSchema.nextDueDate.optional(),
    isActive: z.boolean().optional(),
  })
  .strict();
