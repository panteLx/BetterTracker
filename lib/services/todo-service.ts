import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { todoComments, todoItems, todoLists, user } from "@/lib/db/schema";
import { canWriteTracker as canWriteWorkspace, type TrackerPermission } from "@/lib/auth/permissions";
import {
  todoCommentInputSchema,
  todoItemInputSchema,
  todoItemReorderSchema,
  todoItemUpdateSchema,
  todoListInputSchema,
  todoListUpdateSchema,
} from "@/lib/validators/todo";
import { NotFoundError, ValidationError } from "@/lib/errors";

const itemSelect = {
  id: todoItems.id,
  listId: todoItems.listId,
  body: todoItems.body,
  isDone: todoItems.isDone,
  dueDate: todoItems.dueDate,
  priority: todoItems.priority,
  position: todoItems.position,
  assigneeUserId: todoItems.assigneeUserId,
  assigneeName: user.name,
  createdByUserId: todoItems.createdByUserId,
  createdAt: todoItems.createdAt,
  updatedAt: todoItems.updatedAt,
  commentCount: sql<number>`(select count(*) from ${todoComments} where ${todoComments.itemId} = ${todoItems.id})`,
};

export type TodoItemWithMeta = typeof todoItems.$inferSelect & {
  assigneeName: string | null;
  commentCount: number;
};

export type TodoListWithItems = typeof todoLists.$inferSelect & {
  items: TodoItemWithMeta[];
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
    .select(itemSelect)
    .from(todoItems)
    .leftJoin(user, eq(user.id, todoItems.assigneeUserId))
    .where(
      inArray(
        todoItems.listId,
        lists.map((list) => list.id)
      )
    )
    .orderBy(asc(todoItems.isDone), asc(todoItems.position), asc(todoItems.createdAt));

  const itemsByListId = new Map<string, TodoItemWithMeta[]>();
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

  return { ...list, items: [] as TodoItemWithMeta[] };
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

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)` })
    .from(todoItems)
    .where(eq(todoItems.listId, listId));

  const [item] = await db
    .insert(todoItems)
    .values({
      listId,
      body: data.body,
      dueDate: data.dueDate ?? null,
      priority: data.priority ?? "normal",
      assigneeUserId: data.assigneeUserId ?? null,
      position: count,
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
      dueDate: data.dueDate,
      priority: data.priority,
      assigneeUserId: data.assigneeUserId,
      updatedAt: new Date(),
    })
    .where(eq(todoItems.id, itemId))
    .returning();

  return updated;
}

export async function reorderTodoItems(
  workspaceId: string,
  listId: string,
  input: unknown,
  permission: TrackerPermission | null
) {
  const list = await getTodoListById(workspaceId, listId);
  if (!list) {
    throw new NotFoundError("To-do list not found");
  }
  assertCanWrite(permission);

  const data = todoItemReorderSchema.parse(input);

  const existingItems = await db
    .select({ id: todoItems.id })
    .from(todoItems)
    .where(eq(todoItems.listId, listId));
  const existingIds = new Set(existingItems.map((item) => item.id));

  if (
    data.itemIds.length !== existingIds.size ||
    data.itemIds.some((id) => !existingIds.has(id))
  ) {
    throw new ValidationError("itemIds must match the list's current items");
  }

  await Promise.all(
    data.itemIds.map((id, index) =>
      db.update(todoItems).set({ position: index }).where(eq(todoItems.id, id))
    )
  );
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

export async function listTodoComments(workspaceId: string, listId: string, itemId: string) {
  const list = await getTodoListById(workspaceId, listId);
  if (!list) {
    throw new NotFoundError("To-do list not found");
  }
  const item = await getTodoItemById(listId, itemId);
  if (!item) {
    throw new NotFoundError("To-do item not found");
  }

  return db
    .select({
      id: todoComments.id,
      itemId: todoComments.itemId,
      authorUserId: todoComments.authorUserId,
      authorName: user.name,
      body: todoComments.body,
      createdAt: todoComments.createdAt,
    })
    .from(todoComments)
    .leftJoin(user, eq(user.id, todoComments.authorUserId))
    .where(eq(todoComments.itemId, itemId))
    .orderBy(asc(todoComments.createdAt));
}

export async function createTodoComment(
  workspaceId: string,
  listId: string,
  itemId: string,
  input: unknown,
  permission: TrackerPermission | null,
  actorUserId: string
) {
  const list = await getTodoListById(workspaceId, listId);
  if (!list) {
    throw new NotFoundError("To-do list not found");
  }
  const item = await getTodoItemById(listId, itemId);
  if (!item) {
    throw new NotFoundError("To-do item not found");
  }
  assertCanWrite(permission);

  const data = todoCommentInputSchema.parse(input);

  const [comment] = await db
    .insert(todoComments)
    .values({
      itemId,
      authorUserId: actorUserId,
      body: data.body,
    })
    .returning();

  return comment;
}

export async function deleteTodoComment(
  workspaceId: string,
  listId: string,
  itemId: string,
  commentId: string,
  permission: TrackerPermission | null
) {
  const list = await getTodoListById(workspaceId, listId);
  if (!list) {
    throw new NotFoundError("To-do list not found");
  }
  const item = await getTodoItemById(listId, itemId);
  if (!item) {
    throw new NotFoundError("To-do item not found");
  }

  const rows = await db
    .select()
    .from(todoComments)
    .where(and(eq(todoComments.id, commentId), eq(todoComments.itemId, itemId)))
    .limit(1);
  if (!rows[0]) {
    throw new NotFoundError("Comment not found");
  }

  assertCanWrite(permission);

  await db.delete(todoComments).where(eq(todoComments.id, commentId));
}
