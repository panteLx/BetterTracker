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

const sqlite = new Database(dbPath);
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");

export const db = drizzle(sqlite, { schema });
export { sqlite };
