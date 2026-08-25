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

export const todoListReorderSchema = z
  .object({
    listIds: z.array(z.string().min(1)).min(1),
  })
  .strict();

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date");
const priority = z.enum(["low", "normal", "high"]);

export const todoItemInputSchema = z
  .object({
    body: z.string().trim().min(1).max(2000),
    dueDate: isoDate.nullable().optional(),
    priority: priority.optional(),
    assigneeUserId: z.string().min(1).nullable().optional(),
  })
  .strict();

export const todoItemUpdateSchema = z
  .object({
    body: z.string().trim().min(1).max(2000).optional(),
    isDone: z.boolean().optional(),
    dueDate: isoDate.nullable().optional(),
    priority: priority.optional(),
    assigneeUserId: z.string().min(1).nullable().optional(),
  })
  .strict();

export const todoItemMoveSchema = z
  .object({
    targetListId: z.string().min(1),
    position: z.number().int().min(0),
  })
  .strict();

export const todoCommentInputSchema = z
  .object({
    body: z.string().trim().min(1).max(2000),
  })
  .strict();
