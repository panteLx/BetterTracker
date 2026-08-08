import { z } from "zod";

const caseFileBaseSchema = {
  patientName: z.string().trim().min(1),
  fileNumber: z.string().trim().min(1),
  dateOfBirth: z.string().date().optional().nullable(),
  caseType: z.enum(["ambulant", "stationaer", "konsil"]),
};

export const caseFileInputSchema = z
  .object({
    ...caseFileBaseSchema,
  })
  .strict();

export const caseFileUpdateSchema = z
  .object({
    patientName: caseFileBaseSchema.patientName.optional(),
    fileNumber: caseFileBaseSchema.fileNumber.optional(),
    dateOfBirth: caseFileBaseSchema.dateOfBirth,
    caseType: caseFileBaseSchema.caseType.optional(),
  })
  .strict();
