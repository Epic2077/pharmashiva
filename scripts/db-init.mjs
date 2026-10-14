#!/usr/bin/env node
/**
 * Apply every SQL file in supabase/migrations/ to the linked Supabase project,
 * in filename order.
 *
 * Uses the Supabase Management API, so no `psql` install or database password is
 * needed — only `SUPABASE_URL` (for the project ref) and `SUPABASE_ACCESS_TOKEN`.
 *
 *   npm run db:init            # apply all migrations
 *   npm run db:init -- 0001    # apply only files whose name starts with "0001"
 *
 * Migrations are written to be idempotent (`create table if not exists`,
 * `drop policy if exists`, `create or replace function`), so re-running is safe.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const MIGRATIONS_DIR = join(process.cwd(), "supabase", "migrations");

/** Minimal .env reader: KEY=value lines, no dependency, no interpolation. */
function loadEnv(file = ".env") {
  let raw;
  try {
    raw = readFileSync(join(process.cwd(), file), "utf8");
  } catch {
    return;
  }
  for (const line of raw.split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*)$/);
    if (!match) continue;
    const value = match[2].trim().replace(/^["']|["']$/g, "");
    // A real environment variable always wins over the file.
    process.env[match[1]] ??= value;
  }
}

function fail(message) {
  console.error(`\n  ✖ ${message}\n`);
  process.exit(1);
}

loadEnv();

const url = (process.env.SUPABASE_URL ?? "").trim();
const token = (process.env.SUPABASE_ACCESS_TOKEN ?? "").trim();

if (!url || !token) {
  fail(
    "SUPABASE_URL and SUPABASE_ACCESS_TOKEN must be set (see .env.example).",
  );
}

let ref;
try {
  ref = new URL(url).hostname.split(".")[0];
} catch {
  fail(`SUPABASE_URL is not a valid URL: ${url}`);
}

const filter = process.argv[2] ?? "";

let files;
try {
  files = readdirSync(MIGRATIONS_DIR)
    .filter((name) => name.endsWith(".sql"))
    .filter((name) => name.startsWith(filter))
    .sort();
} catch {
  fail(`No migrations directory at supabase/migrations (cwd: ${process.cwd()}).`);
}

if (files.length === 0) {
  fail(
    filter
      ? `No migration files start with "${filter}".`
      : "No .sql files in supabase/migrations.",
  );
}

console.log(`\nApplying ${files.length} migration(s) to project ${ref}\n`);

for (const file of files) {
  const sql = readFileSync(join(MIGRATIONS_DIR, file), "utf8");

  const response = await fetch(
    `https://api.supabase.com/v1/projects/${ref}/database/query`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ query: sql }),
    },
  );

  if (!response.ok) {
    const detail = await response.text();
    console.error(`  ✖ ${file} — HTTP ${response.status}`);
    console.error(`    ${detail.slice(0, 600)}`);
    process.exit(1);
  }

  console.log(`  ✔ ${file}`);
}

console.log("\nDone.\n");
