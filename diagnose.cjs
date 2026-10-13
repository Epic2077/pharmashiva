const fs = require("fs");
const lines = fs.readFileSync(".env", "utf8").split(/\r?\n/);
const env = {};
for (const l of lines) {
  const t = l.trim();
  if (!t || t.startsWith("#")) continue;
  const i = t.indexOf("=");
  if (i > 0) env[t.slice(0, i)] = t.slice(i + 1);
}
const { createClient } = require("@supabase/supabase-js");
const sb = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

(async () => {
  const out = [];
  const count = await sb
    .from("categories")
    .select("*", { count: "exact", head: true });
  out.push("categories: " + count.count);

  const roots = await sb
    .from("categories")
    .select("name, slug, breadcrumbs, parent_id")
    .is("parent_id", null);
  out.push("roots: " + JSON.stringify(roots.data));

  const sample = await sb
    .from("categories")
    .select("name, slug, breadcrumbs")
    .not("parent_id", "is", null)
    .limit(15);
  out.push("non-root sample: " + JSON.stringify(sample.data));

  fs.writeFileSync("diagnose.txt", out.join("\n"));
})();
