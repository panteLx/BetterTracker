import { z } from "zod";

export const todoListInputSchema = z
  .object({
    name: z.string().trim().min(1).max(200),
  })
  .strict();

export const todoListUpdateSchema = z
  .object({
    name: z.string().trim().min(1).max(200).optional(),
    isArchived: z.boolean().optional(),
  })
  .strict();

export const todoItemInputSchema = z
  .object({
    body: z.string().trim().min(1).max(2000),
  })
  .strict();

export const todoItemUpdateSchema = z
  .object({
    body: z.string().trim().min(1).max(2000).optional(),
    isDone: z.boolean().optional(),
  })
  .strict();
