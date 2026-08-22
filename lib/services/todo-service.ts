import { and, asc, eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { todoItems, todoLists } from "@/lib/db/schema";
import { canWriteTracker as canWriteWorkspace, type TrackerPermission } from "@/lib/auth/permissions";
import {
  todoItemInputSchema,
  todoItemUpdateSchema,
  todoListInputSchema,
  todoListUpdateSchema,
} from "@/lib/validators/todo";
import { NotFoundError, ValidationError } from "@/lib/errors";

export type TodoListWithItems = typeof todoLists.$inferSelect & {
  items: (typeof todoItems.$inferSelect)[];
};

export async function listTodoLists(
  workspaceId: string,
  options?: { isArchived?: boolean }
): Promise<TodoListWithItems[]> {
  const isArchived = options?.isArchived ?? false;
  const lists = await db
    .select()
    .from(todoLists)
    .where(and(eq(todoLists.workspaceId, workspaceId), eq(todoLists.isArchived, isArchived)))
    .orderBy(asc(todoLists.createdAt));

  if (lists.length === 0) {
    return [];
  }

  const items = await db
    .select()
    .from(todoItems)
    .where(
      inArray(
        todoItems.listId,
        lists.map((list) => list.id)
      )
    )
    .orderBy(asc(todoItems.isDone), asc(todoItems.createdAt));

  const itemsByListId = new Map<string, (typeof todoItems.$inferSelect)[]>();
  for (const item of items) {
    const bucket = itemsByListId.get(item.listId);
    if (bucket) {
      bucket.push(item);
    } else {
      itemsByListId.set(item.listId, [item]);
    }
  }

  return lists.map((list) => ({ ...list, items: itemsByListId.get(list.id) ?? [] }));
}

export async function getTodoListById(workspaceId: string, listId: string) {
  const rows = await db
    .select()
    .from(todoLists)
    .where(and(eq(todoLists.id, listId), eq(todoLists.workspaceId, workspaceId)))
    .limit(1);
  return rows[0] ?? null;
}

function assertCanWrite(permission: TrackerPermission | null) {
  if (!canWriteWorkspace(permission)) {
    throw new ValidationError("You cannot edit this workspace's to-do lists");
  }
}

export async function createTodoList(workspaceId: string, input: unknown, actorUserId: string) {
  const data = todoListInputSchema.parse(input);

  const [list] = await db
    .insert(todoLists)
    .values({
      workspaceId,
      name: data.name,
      createdByUserId: actorUserId,
    })
    .returning();

  return { ...list, items: [] as (typeof todoItems.$inferSelect)[] };
}

export async function updateTodoList(
  workspaceId: string,
  listId: string,
  input: unknown,
  permission: TrackerPermission | null
) {
  const existing = await getTodoListById(workspaceId, listId);
  if (!existing) {
    throw new NotFoundError("To-do list not found");
  }
  assertCanWrite(permission);

  const data = todoListUpdateSchema.parse(input);

  const [updated] = await db
    .update(todoLists)
    .set({ name: data.name, isArchived: data.isArchived, updatedAt: new Date() })
    .where(eq(todoLists.id, listId))
    .returning();

  return updated;
}

export async function deleteTodoList(
  workspaceId: string,
  listId: string,
  permission: TrackerPermission | null
) {
  const existing = await getTodoListById(workspaceId, listId);
  if (!existing) {
    throw new NotFoundError("To-do list not found");
  }
  assertCanWrite(permission);

  await db.delete(todoLists).where(eq(todoLists.id, listId));
}

async function getTodoItemById(listId: string, itemId: string) {
  const rows = await db
    .select()
    .from(todoItems)
    .where(and(eq(todoItems.id, itemId), eq(todoItems.listId, listId)))
    .limit(1);
  return rows[0] ?? null;
}

export async function createTodoItem(
  workspaceId: string,
  listId: string,
  input: unknown,
  permission: TrackerPermission | null,
  actorUserId: string
) {
  const list = await getTodoListById(workspaceId, listId);
  if (!list) {
    throw new NotFoundError("To-do list not found");
  }
  assertCanWrite(permission);

  const data = todoItemInputSchema.parse(input);

  const [item] = await db
    .insert(todoItems)
    .values({
      listId,
      body: data.body,
      createdByUserId: actorUserId,
    })
    .returning();

  return item;
}

export async function updateTodoItem(
  workspaceId: string,
  listId: string,
  itemId: string,
  input: unknown,
  permission: TrackerPermission | null
) {
  const list = await getTodoListById(workspaceId, listId);
  if (!list) {
    throw new NotFoundError("To-do list not found");
  }
  const existing = await getTodoItemById(listId, itemId);
  if (!existing) {
    throw new NotFoundError("To-do item not found");
  }
  assertCanWrite(permission);

  const data = todoItemUpdateSchema.parse(input);

  const [updated] = await db
    .update(todoItems)
    .set({
      body: data.body,
      isDone: data.isDone,
      updatedAt: new Date(),
    })
    .where(eq(todoItems.id, itemId))
    .returning();

  return updated;
}

export async function deleteTodoItem(
  workspaceId: string,
  listId: string,
  itemId: string,
  permission: TrackerPermission | null
) {
  const list = await getTodoListById(workspaceId, listId);
  if (!list) {
    throw new NotFoundError("To-do list not found");
  }
  const existing = await getTodoItemById(listId, itemId);
  if (!existing) {
    throw new NotFoundError("To-do item not found");
  }
  assertCanWrite(permission);

  await db.delete(todoItems).where(eq(todoItems.id, itemId));
}
