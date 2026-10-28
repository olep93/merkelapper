import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
process.loadEnvFile(".env.local");
const base = process.argv[2];
if (!base) throw new Error("Oppgi testadresse");
const qa = JSON.parse(readFileSync(".qa-account.json", "utf8"));
let jar = [];
const db = createServerClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  {
    cookies: {
      getAll: () => jar,
      setAll: (items) => {
        for (const c of items) {
          jar = jar.filter((x) => x.name !== c.name);
          jar.push(c);
        }
      },
    },
  },
);
const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY,
  { auth: { persistSession: false } },
);
const { error } = await db.auth.signInWithPassword({
  email: qa.email,
  password: qa.password,
});
if (error) throw error;
const headers = {
  Origin: base,
  "Content-Type": "application/json",
  Cookie: jar.map((c) => c.name + "=" + c.value).join("; "),
};
async function call(path, method = "GET", body) {
  const r = await fetch(base + "/merkelapp/api" + path, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: r.status, data: await r.json() };
}
const products = JSON.parse(
  readFileSync("tmp/obsbygg/verified-products.json", "utf8"),
).slice(0, 9);
const body = {
  title: "Papirkurvtest",
  date: "2026-10-28",
  location: "",
  lines: products.map((p, i) => ({
    id: crypto.randomUUID(),
    ean: p.ean,
    name: p.name,
    quantity: i + 1,
    product: p,
  })),
};
const id = crypto.randomUUID();
let r = await call("/sheets", "POST", {
  id,
  operation: crypto.randomUUID(),
  body,
});
assert.equal(r.status, 200, JSON.stringify(r.data));
let sheet = r.data;
async function action(action) {
  const r = await call("/sheets/" + id, "PATCH", {
    action,
    version: sheet.version,
    operation: crypto.randomUUID(),
  });
  assert.equal(r.status, 200, JSON.stringify(r.data));
  sheet = r.data;
  return r;
}
try {
  await action("lock");
  await action("delete");
  assert.ok(sheet.deleted_at);
  const active = await call("/sheets");
  assert.ok(!active.data.some((s) => s.id === id));
  const all = await call("/sheets?include_deleted=1");
  assert.ok(all.data.some((s) => s.id === id && s.deleted_at));
  const pdf = await fetch(base + "/merkelapp/api/sheets/" + id + "/pdf", {
    headers,
  });
  assert.equal(pdf.status, 404);
  await action("restore");
  assert.equal(sheet.deleted_at, null);
  assert.equal(sheet.state, "locked");
  assert.equal(sheet.revision, 1);
  assert.deepEqual(sheet.body, body);
  const revisions = await db
    .from("merkelapp_revisions")
    .select("body")
    .eq("sheet_id", id);
  assert.equal(revisions.data.length, 1);
  assert.deepEqual(revisions.data[0].body, body);
  await action("delete");
  const expired = await admin
    .from("merkelapp_sheets")
    .update({ deleted_at: new Date(Date.now() - 8 * 86400000).toISOString() })
    .eq("id", id);
  if (expired.error) throw expired.error;
  assert.ok(
    !(await call("/sheets?include_deleted=1")).data.some((s) => s.id === id),
  );
  assert.equal(
    (
      await call("/sheets/" + id, "PATCH", {
        action: "restore",
        version: sheet.version,
        operation: crypto.randomUUID(),
      })
    ).status,
    404,
  );
  const cleanup = await fetch(base + "/merkelapp/api/cleanup", {
    headers: { Authorization: "Bearer " + process.env.CRON_SECRET },
  });
  assert.equal(cleanup.status, 200);
  assert.equal(
    (await admin.from("merkelapp_sheets").select("id").eq("id", id)).data
      .length,
    0,
  );
  console.log(
    "PASS: active list hides trash; trash preserves nine rows and locked revision; restore returns exact content; expired trash cannot be restored and is cleaned up",
  );
} finally {
  await admin.from("merkelapp_sheets").delete().eq("id", id);
}
