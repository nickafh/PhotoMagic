import { createClient } from "@libsql/client";
import { readFileSync, readdirSync } from "fs";
import { join } from "path";

const url = process.env.DATABASE_URL || "file:/app/data/photomagic.db";
const client = createClient({ url });

// Check if the database already has tables
const result = await client.execute(
  "SELECT name FROM sqlite_master WHERE type='table' AND name='User'"
);

if (result.rows.length > 0) {
  console.log("[init-db] Database already initialized, skipping migrations.");
  process.exit(0);
}

// Run all migration SQL files in order
const migrationsDir = join(process.cwd(), "prisma", "migrations");
const dirs = readdirSync(migrationsDir, { withFileTypes: true })
  .filter((d) => d.isDirectory() && d.name !== "migration_lock.toml")
  .sort((a, b) => a.name.localeCompare(b.name));

for (const dir of dirs) {
  const sqlPath = join(migrationsDir, dir.name, "migration.sql");
  try {
    const sql = readFileSync(sqlPath, "utf-8");
    // Split on semicolons and run each statement
    const statements = sql
      .split(";")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    for (const stmt of statements) {
      await client.execute(stmt);
    }
    console.log(`[init-db] Applied migration: ${dir.name}`);
  } catch (e) {
    console.error(`[init-db] Failed on migration ${dir.name}:`, e.message);
    process.exit(1);
  }
}

console.log("[init-db] Database initialized successfully.");
