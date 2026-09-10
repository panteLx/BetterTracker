import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import fs from "fs";
import path from "path";
import * as schema from "./schema";
import { env } from "@/lib/env";

const rawPath = env.databaseUrl.replace(/^file:/, "");
const dbPath = path.isAbsolute(rawPath)
  ? rawPath
  : path.join(/* turbopackIgnore: true */ process.cwd(), rawPath);

fs.mkdirSync(path.dirname(dbPath), { recursive: true });

// Switching a rollback-journal database to WAL takes an exclusive lock and SQLite
// answers SQLITE_BUSY without consulting busy_timeout, so the parallel workers
// `next build` uses to collect page data can collide on a freshly migrated file.
function enableWalMode(database: Database.Database) {
  for (let attempt = 0; ; attempt++) {
    if (database.pragma("journal_mode", { simple: true }) === "wal") {
      return;
    }

    try {
      database.pragma("journal_mode = WAL");
      return;
    } catch (error) {
      if ((error as { code?: string }).code !== "SQLITE_BUSY" || attempt >= 50) {
        throw error;
      }
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 20);
    }
  }
}

const sqlite = new Database(dbPath);
enableWalMode(sqlite);
sqlite.pragma("foreign_keys = ON");

export const db = drizzle(sqlite, { schema });
export { sqlite };
