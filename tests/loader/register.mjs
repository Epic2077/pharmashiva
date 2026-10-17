// Node test bootstrap: registers the resolver that makes `@/` aliases and
// extensionless TypeScript imports work under `node --test`.
import { register } from "node:module";

register(new URL("./resolve.mjs", import.meta.url));
