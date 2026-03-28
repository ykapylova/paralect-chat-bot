import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";

declare global {
  var __chatbotDbPool: Pool | undefined;
  var __chatbotDb: NodePgDatabase | undefined;
}

function getPool() {
  if (global.__chatbotDbPool) return global.__chatbotDbPool;

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set. Configure Supabase Postgres URL.");
  }

  global.__chatbotDbPool = new Pool({ connectionString });
  return global.__chatbotDbPool;
}

export function getDb() {
  if (global.__chatbotDb) return global.__chatbotDb;
  global.__chatbotDb = drizzle(getPool());
  return global.__chatbotDb;
}
