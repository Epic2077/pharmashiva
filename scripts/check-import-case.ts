/* Temporary check: verify every local import resolves with exact filename case. */
import { execSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

const tracked = execSync("git ls-files '*.ts' '*.tsx'", {
  encoding: "utf8",
})
  .split("\n")
  .filter(Boolean);

const trackedSet = new Set(tracked);
const dirCache = new Map();
function listDir(dir: string): Set<string> {
  if (!dirCache.has(dir)) {
    try {
      dirCache.set(dir, new Set(readdirSync(dir)));
    } catch {
      dirCache.set(dir, new Set());
    }
  }
  return dirCache.get(dir)!;
}

function exactExists(candidate: string): boolean {
  if (!trackedSet.has(candidate)) return false;
  const dir = dirname(candidate) === "." ? "" : dirname(candidate);
  const name = candidate.slice(dir ? dir.length + 1 : 0);
  return listDir(dir).has(name);
}

function resolveImport(fromFile: string, specifier: string): string | null {
  let base: string;
  if (specifier.startsWith("@/")) base = specifier.slice(2);
  else if (specifier.startsWith("./") || specifier.startsWith("../"))
    base = resolve(dirname(fromFile), specifier).replace(/\\/g, "/");
  else return null;

  const candidates = [
    base,
    `${base}.ts`,
    `${base}.tsx`,
    `${base}/index.ts`,
    `${base}/index.tsx`,
  ];
  return candidates.find(exactExists) ?? null;
}

const problems: string[] = [];
for (const file of tracked) {
  let source: string;
  try {
    source = readFileSync(file, "utf8");
  } catch {
    continue;
  }
  const importPattern = /(?:from\s+|import\s*\()\s*["']([^"']+)["']/g;
  for (const match of source.matchAll(importPattern)) {
    const specifier = match[1];
    if (!specifier.startsWith("@/") && !specifier.startsWith(".")) continue;
    // Only check specifiers that should resolve to repo files.
    if (specifier.includes(".css")) continue;
    if (!resolveImport(file, specifier)) {
      problems.push(`${file} -> ${specifier}`);
    }
  }
}

if (problems.length === 0) console.log("OK: all local imports match exact tracked filenames");
else {
  console.log("CASE/MISSING IMPORT PROBLEMS:");
  for (const problem of problems) console.log(" -", problem);
  process.exitCode = 1;
}
