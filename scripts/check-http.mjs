import { createServerClient } from "@supabase/ssr";
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
process.loadEnvFile(".env.local");
const base = process.argv[2];
if (!base) throw new Error("Oppgi portalens URL som første argument.");
const qa = JSON.parse(readFileSync(".qa-account.json", "utf8"));
let jar = [];
const db = createServerClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  {
    cookies: {
      getAll: () => jar,
      setAll: (all) => {
        for (const c of all) {
          jar = jar.filter((x) => x.name !== c.name);
          jar.push(c);
        }
      },
    },
  },
);
const { error } = await db.auth.signInWithPassword({
  email: qa.email,
  password: qa.password,
});
if (error) throw error;
async function call(path, method = "GET", body) {
  const r = await fetch(base + "/merkelapp/api" + path, {
    method,
    headers: {
      Origin: base,
      "Content-Type": "application/json",
      Cookie: jar.map((c) => c.name + "=" + c.value).join("; "),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return {
    status: r.status,
    data: r.headers.get("Content-Type")?.includes("application/pdf")
      ? new Uint8Array(await r.arrayBuffer())
      : await r.json(),
  };
}
assert.equal((await call("/session")).status, 200);
assert.equal((await fetch(base + "/merkelapp/api/session")).status, 401);
const id = crypto.randomUUID(),
  body = {
    title: "HTTP quality test",
    date: "2026-10-28",
    location: "",
    lines: [
      {
        id: crypto.randomUUID(),
        ean: "7025180735989",
        name: "Kellen skruesett 270 stk",
        quantity: 24,
      },
    ],
  };
let r = await call("/sheets", "POST", {
  id,
  operation: crypto.randomUUID(),
  body,
});
assert.equal(r.status, 200, JSON.stringify(r.data));
let s = r.data;
async function action(action) {
  const r = await call("/sheets/" + id, "PATCH", {
    action,
    version: s.version,
    operation: crypto.randomUUID(),
  });
  assert.equal(r.status, 200, JSON.stringify(r.data));
  s = r.data;
}
try {
  assert.equal((await call("/sheets/" + id + "/pdf")).status, 409);
  const layout = await call("/layout", "POST", body);
  assert.equal(layout.status, 200);
  assert.equal(layout.data.pages.length, 1);
  await action("lock");
  const pdf = await call("/sheets/" + id + "/pdf");
  assert.equal(pdf.status, 200);
  assert.ok(pdf.data.length > 1000);
  assert.equal(new TextDecoder().decode(pdf.data.slice(0, 4)), "%PDF");
  await action("printed");
  assert.ok(s.delete_after);
  await action("reopen");
  assert.equal((await call("/sheets/" + id + "/pdf")).status, 409);
  assert.equal(s.delete_after, null);
  const csrf = await fetch(base + "/merkelapp/api/sheets/" + id, {
    method: "PATCH",
    headers: {
      Origin: "https://example.com",
      Cookie: jar.map((c) => c.name + "=" + c.value).join("; "),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      action: "delete",
      version: s.version,
      operation: crypto.randomUUID(),
    }),
  });
  assert.equal(csrf.status, 403);
  console.log(
    "PASS: portal session, unauthorized denial, server write, layout, locked PDF, print retention, reopen invalidation, cross-origin write rejection",
  );
} finally {
  await action("delete");
}
