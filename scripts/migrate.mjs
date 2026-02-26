/**
 * Lightweight migration runner for standalone Docker builds.
 * Uses @libsql/client (already bundled) instead of requiring the full Prisma CLI.
 * Reads prisma/migrations/ and applies any that haven't been run yet.
 */
import { createClient } from "@libsql/client";
import { readFileSync, readdirSync, existsSync } from "fs";
import { join } from "path";
import { randomUUID } from "crypto";

const dbUrl = process.env.DATABASE_URL || "file:/app/data/photomagic.db";
const migrationsDir = join(process.cwd(), "prisma", "migrations");

const client = createClient({ url: dbUrl });

async function run() {
  // Ensure _prisma_migrations table exists
  await client.execute(`
    CREATE TABLE IF NOT EXISTS "_prisma_migrations" (
      "id"                    TEXT PRIMARY KEY NOT NULL,
      "checksum"              TEXT NOT NULL,
      "finished_at"           DATETIME,
      "migration_name"        TEXT NOT NULL,
      "logs"                  TEXT,
      "rolled_back_at"        DATETIME,
      "started_at"            DATETIME NOT NULL DEFAULT current_timestamp,
      "applied_steps_count"   INTEGER NOT NULL DEFAULT 0
    )
  `);

  // Get already-applied migrations
  const applied = await client.execute("SELECT migration_name FROM _prisma_migrations WHERE rolled_back_at IS NULL");
  const appliedSet = new Set(applied.rows.map((r) => r.migration_name));

  // Read migration directories (sorted)
  const dirs = readdirSync(migrationsDir)
    .filter((d) => existsSync(join(migrationsDir, d, "migration.sql")))
    .sort();

  let count = 0;
  for (const dir of dirs) {
    if (appliedSet.has(dir)) continue;

    const sqlPath = join(migrationsDir, dir, "migration.sql");
    const sql = readFileSync(sqlPath, "utf-8");

    console.log(`[migrate] Applying ${dir}...`);

    // Split on semicolons and run each statement
    const statements = sql
      .split(";")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    for (const stmt of statements) {
      await client.execute(stmt);
    }

    // Record migration
    await client.execute({
      sql: `INSERT INTO "_prisma_migrations" (id, checksum, finished_at, migration_name, applied_steps_count)
            VALUES (?, ?, datetime('now'), ?, ?)`,
      args: [randomUUID(), "", dir, statements.length],
    });

    count++;
    console.log(`[migrate] Applied ${dir} (${statements.length} statements)`);
  }

  if (count === 0) {
    console.log("[migrate] Database is up to date.");
  } else {
    console.log(`[migrate] Applied ${count} migration(s).`);
  }

  client.close();
}

run().catch((err) => {
  console.error("[migrate] Error:", err);
  process.exit(1);
});
