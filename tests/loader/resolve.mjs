// Resolver hook for Node's test runner:
//  - "@/"      -> project root (tsconfig "paths")
//  - "./x"     -> extensionless relative imports resolve to .ts/.tsx/index.ts
import { existsSync } from "node:fs";
import { dirname, resolve as resolvePath } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = fileURLToPath(new URL("../../", import.meta.url));

function tryCandidates(target) {
  const candidates = [
    target,
    `${target}.ts`,
    `${target}.tsx`,
    `${target}.mts`,
    `${target}.cts`,
    `${target}/index.ts`,
    `${target}/index.tsx`,
    `${target}/index.mts`,
  ];
  for (const candidate of candidates) {
    if (existsSync(candidate)) return pathToFileURL(candidate).href;
  }
  return null;
}

export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith("@/")) {
    const found = tryCandidates(resolvePath(root, specifier.slice(2)));
    if (found) return { shortCircuit: true, url: found };
  }
  if (
    (specifier.startsWith("./") || specifier.startsWith("../")) &&
    context.parentURL?.startsWith("file:")
  ) {
    const found = tryCandidates(
      resolvePath(dirname(fileURLToPath(context.parentURL)), specifier),
    );
    if (found) return { shortCircuit: true, url: found };
  }
  return nextResolve(specifier, context);
}
