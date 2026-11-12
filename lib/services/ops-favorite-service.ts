import { asc, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { opsFavorites } from "@/lib/db/schema";
import { NotFoundError } from "@/lib/errors";
import { opsFavoriteSchema, type OpsFavoriteInput } from "@/lib/validators/ops";

export type OpsFavorite = { id: string; opsCode: string; description: string; isHybrid: boolean };

const columns = {
  id: opsFavorites.id,
  opsCode: opsFavorites.opsCode,
  description: opsFavorites.description,
  isHybrid: opsFavorites.isHybrid,
};

export async function listFavorites(): Promise<OpsFavorite[]> {
  return db
    .select(columns)
    .from(opsFavorites)
    .orderBy(asc(opsFavorites.sortOrder), asc(opsFavorites.createdAt))
    .all();
}

export async function createFavorite(input: OpsFavoriteInput): Promise<OpsFavorite> {
  const value = opsFavoriteSchema.parse(input);
  const next = db
    .select({ n: sql<number>`coalesce(max(${opsFavorites.sortOrder}), -1) + 1` })
    .from(opsFavorites)
    .all()[0].n;
  return db.insert(opsFavorites).values({ ...value, sortOrder: next }).returning(columns).all()[0];
}

export async function updateFavorite(id: string, input: OpsFavoriteInput): Promise<OpsFavorite> {
  const value = opsFavoriteSchema.parse(input);
  const row = db.update(opsFavorites).set(value).where(eq(opsFavorites.id, id)).returning(columns).all()[0];
  if (!row) throw new NotFoundError("Entry not found");
  return row;
}

export async function deleteFavorite(id: string): Promise<void> {
  const rows = db.delete(opsFavorites).where(eq(opsFavorites.id, id)).returning({ id: opsFavorites.id }).all();
  if (rows.length === 0) throw new NotFoundError("Entry not found");
}
