/**
 * Public surface of the Darukade connector.
 *
 * Imports here use explicit `.ts` specifiers so the module graph can be run
 * directly by Node's TypeScript loader (the sync script) as well as bundled by
 * Next.js. Nothing in this folder is imported on a user request path.
 *
 * Note: `service.ts` and `categories.ts` are intentionally NOT re-exported —
 * they import `@/` aliases that only Next.js resolves, and the sync script
 * must stay runnable under plain Node.
 */

export * from "./config.ts";
export * from "./errors.ts";
export * from "./http.ts";
export * from "./next-data.ts";
export * from "./types.ts";
export * from "./normalize.ts";
export * from "./client.ts";
export * from "./validate.ts";
export * from "./repository.ts";
