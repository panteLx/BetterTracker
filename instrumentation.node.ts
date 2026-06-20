import path from "node:path";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { db } from "@/lib/db";

export function migrateDatabase() {
  migrate(db, {
    migrationsFolder: path.join(process.cwd(), "drizzle"),
  });
}
