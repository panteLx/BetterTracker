import { z } from "zod";

export const treatmentTypeSchema = z.enum(["stat", "hybrid", "aop"]);
export type PathologyTreatmentType = z.infer<typeof treatmentTypeSchema>;

const isoDate = z.string().date();

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullable()
    .optional()
    .transform((value) => (value ? value : null));

export const importEntrySchema = z
  .object({
    sampleNumber: z.string().trim().min(1).max(32),
    patientName: z.string().trim().min(1).max(200),
    dateOfBirth: isoDate.nullable().optional().transform((v) => v ?? null),
    receivedDate: isoDate.nullable().optional().transform((v) => v ?? null),
    liquid: optionalText(4),
    sender: optionalText(100),
    material: optionalText(500),
    isCancerRegistry: z.boolean(),
  })
  .strict();

export const commitImportSchema = z
  .object({
    sourceFileName: z.string().trim().min(1).max(255),
    periodStart: isoDate,
    periodEnd: isoDate,
    entries: z.array(importEntrySchema).min(1).max(1000),
  })
  .strict();

const patchText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullable()
    .transform((value) => (value ? value : null));

export const updateEntrySchema = z
  .object({
    treatmentType: treatmentTypeSchema.nullable(),
    insurer: patchText(120),
    insuranceNumber: patchText(40),
    note: patchText(300),
    isCancerRegistry: z.boolean(),
  })
  .partial()
  .strict();

export const archiveListSchema = z.object({ isArchived: z.boolean() }).strict();

export type ImportEntryInput = z.infer<typeof importEntrySchema>;
export type CommitImportInput = z.infer<typeof commitImportSchema>;
export type UpdateEntryInput = z.infer<typeof updateEntrySchema>;
