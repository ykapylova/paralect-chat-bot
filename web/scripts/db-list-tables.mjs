/**
 * Lists tables in the DB from DATABASE_URL (run from /web).
 * Usage: npm run db:tables
 */
import dotenv from "dotenv";
import pg from "pg";

dotenv.config({ path: ".env.local" });
dotenv.config();

const url = process.env.DATABASE_URL?.trim().replace(/^["']|["']$/g, "");
if (!url) {
  console.error("DATABASE_URL is not set (check web/.env.local)");
  process.exit(1);
}

const pool = new pg.Pool({
  connectionString: url,
  ssl:
    url.includes("supabase.co") || url.includes("supabase.com")
      ? { rejectUnauthorized: false }
      : undefined,
});

try {
  const { rows } = await pool.query(`
    SELECT table_schema, table_name
    FROM information_schema.tables
    WHERE table_schema NOT IN ('pg_catalog', 'information_schema')
      AND table_type = 'BASE TABLE'
    ORDER BY table_schema, table_name
  `);
  if (rows.length === 0) {
    console.log("No user tables found (wrong database or empty).");
  } else {
    console.log("Tables:\n");
    for (const r of rows) {
      console.log(`  ${r.table_schema}.${r.table_name}`);
    }
  }
} catch (e) {
  console.error("Connection/query failed:", e.message);
  console.error("\nSupabase: use URI with ?sslmode=require and URL-encode special chars in the password.");
  process.exit(1);
} finally {
  await pool.end();
}
