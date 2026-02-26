export async function register() {
  // Only run migrations on the Node.js server (not edge)
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await applyMigrations();
  }
}

async function applyMigrations() {
  const { readFileSync, readdirSync, existsSync } = await import("fs");
  const { join } = await import("path");

  // Dynamic import so this only loads on the server
  const { PrismaClient } = await import("@/generated/prisma/client");
  const { PrismaLibSql } = await import("@prisma/adapter-libsql");

  const adapter = new PrismaLibSql({
    url: process.env.DATABASE_URL || "file:./prisma/photomagic.db",
  });
  const prisma = new PrismaClient({ adapter });

  try {
    // Ensure _prisma_migrations table exists
    await prisma.$executeRawUnsafe(`
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
    const applied: Array<{ migration_name: string }> = await prisma.$queryRawUnsafe(
      "SELECT migration_name FROM _prisma_migrations WHERE rolled_back_at IS NULL"
    );
    const appliedSet = new Set(applied.map((r) => r.migration_name));

    // Find migration directories
    const migrationsDir = join(process.cwd(), "prisma", "migrations");
    if (!existsSync(migrationsDir)) {
      console.log("[migrate] No migrations directory found, skipping.");
      return;
    }

    const dirs = readdirSync(migrationsDir)
      .filter((d) => existsSync(join(migrationsDir, d, "migration.sql")))
      .sort();

    let count = 0;
    for (const dir of dirs) {
      if (appliedSet.has(dir)) continue;

      const sqlPath = join(migrationsDir, dir, "migration.sql");
      const sql = readFileSync(sqlPath, "utf-8");

      console.log(`[migrate] Applying ${dir}...`);

      const statements = sql
        .split(";")
        .map((s) => s.trim())
        .filter((s) => s.length > 0);

      for (const stmt of statements) {
        await prisma.$executeRawUnsafe(stmt);
      }

      // Record migration
      const id = crypto.randomUUID();
      await prisma.$executeRawUnsafe(
        `INSERT INTO "_prisma_migrations" (id, checksum, finished_at, migration_name, applied_steps_count)
         VALUES ('${id}', '', datetime('now'), '${dir}', ${statements.length})`
      );

      count++;
      console.log(`[migrate] Applied ${dir} (${statements.length} statements)`);
    }

    if (count === 0) {
      console.log("[migrate] Database is up to date.");
    } else {
      console.log(`[migrate] Applied ${count} migration(s).`);
    }
  } catch (err) {
    console.error("[migrate] Migration error:", err);
    // Don't crash the app — existing tables still work
  } finally {
    await prisma.$disconnect();
  }
}
