import { createServerClient } from "@supabase/ssr";
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
process.loadEnvFile(".env.local");
const base = process.argv[2];
if (!base) throw new Error("Oppgi testadressen.");
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
  const response = await fetch(base + "/merkelapp/api" + path, {
    method,
    headers: {
      Origin: base,
      "Content-Type": "application/json",
      Cookie: jar.map((c) => c.name + "=" + c.value).join("; "),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return {
    status: response.status,
    data: response.headers.get("content-type")?.includes("application/pdf")
      ? new Uint8Array(await response.arrayBuffer())
      : await response.json(),
  };
}
const found = await call("/products", "POST", { ean: "7025180735989" });
assert.equal(found.status, 200);
assert.equal(found.data.status, "found", JSON.stringify(found.data));
assert.equal(found.data.product.ean, "7025180735989");
assert.ok(found.data.product.imageUrl);
console.log("Remote product lookup:", found.data.product.name);
assert.equal((await call("/products", "POST", { ean: "123" })).status, 400);
const notFound = await call("/products", "POST", { ean: "0000000000000" });
assert.equal(notFound.data.status, "not_found", JSON.stringify(notFound.data));
const unauth = await fetch(base + "/merkelapp/api/products", {
  method: "POST",
  headers: { Origin: base, "Content-Type": "application/json" },
  body: JSON.stringify({ ean: "7025180735989" }),
});
assert.equal(unauth.status, 401);
const id = crypto.randomUUID(),
  body = {
    title: "Disposable product metadata test",
    date: "2026-10-28",
    location: "",
    lines: [
      {
        id: crypto.randomUUID(),
        ean: "7025180735989",
        name: "Mitt eget varenavn",
        quantity: 2,
        product: found.data.product,
      },
    ],
  };
let r = await call("/sheets", "POST", {
  id,
  operation: crypto.randomUUID(),
  body,
});
assert.equal(r.status, 200, JSON.stringify(r.data));
let sheet = r.data;
try {
  const reload = await call("/sheets/" + id);
  assert.deepEqual(reload.data.body.lines[0].product, found.data.product);
  assert.equal(reload.data.body.lines[0].name, "Mitt eget varenavn");
  r = await call("/sheets/" + id, "PATCH", {
    action: "lock",
    version: sheet.version,
    operation: crypto.randomUUID(),
  });
  assert.equal(r.status, 200);
  sheet = r.data;
  const snapshot = await db
    .from("merkelapp_revisions")
    .select("body")
    .eq("sheet_id", id)
    .eq("revision", 1)
    .single();
  if (snapshot.error) throw snapshot.error;
  assert.deepEqual(snapshot.data.body.lines[0].product, found.data.product);
  assert.equal(snapshot.data.body.lines[0].name, "Mitt eget varenavn");
  assert.equal((await call("/sheets/" + id + "/pdf")).status, 200);
  console.log(
    "PASS: real server lookup, image metadata, missing product, invalid EAN, authentication, account persistence, manual name preservation, frozen snapshot and PDF compatibility",
  );
} finally {
  await call("/sheets/" + id, "PATCH", {
    action: "delete",
    version: sheet.version,
    operation: crypto.randomUUID(),
  });
}
