import { createServerClient } from "@supabase/ssr";
import { readFileSync, writeFileSync } from "node:fs";
import { PDFDocument, PDFName, PDFDict } from "pdf-lib";
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
      setAll: (items) => {
        for (const c of items) {
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
const headers = {
  Origin: base,
  "Content-Type": "application/json",
  Cookie: jar.map((c) => c.name + "=" + c.value).join("; "),
};
async function json(path, method, body) {
  const r = await fetch(base + "/merkelapp/api" + path, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await r.json();
  assert.equal(r.status, 200, JSON.stringify(data));
  return data;
}
const products = JSON.parse(
  readFileSync("tmp/obsbygg/verified-products.json", "utf8"),
);
const body = {
  title: "Disposable PDF image check",
  date: "2026-10-28",
  location: "",
  lines: products.map((p, i) => ({
    id: crypto.randomUUID(),
    ean: p.ean,
    name: p.name,
    quantity: (i + 1) * 12,
    product: p,
  })),
};
const id = crypto.randomUUID();
let sheet = await json("/sheets", "POST", {
  id,
  operation: crypto.randomUUID(),
  body,
});
try {
  const layout = await json("/layout", "POST", body);
  assert.equal(layout.pages.length, 1);
  assert.ok(layout.pages[0].lines.every((r) => r.imageSize > 0));
  sheet = await json("/sheets/" + id, "PATCH", {
    action: "lock",
    version: sheet.version,
    operation: crypto.randomUUID(),
  });
  const start = Date.now(),
    response = await fetch(base + "/merkelapp/api/sheets/" + id + "/pdf", {
      headers,
    });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("X-Missing-Images"), "0");
  const bytes = new Uint8Array(await response.arrayBuffer()),
    pdf = await PDFDocument.load(bytes);
  assert.equal(pdf.getPageCount(), 1);
  const xobjects = pdf
    .getPages()[0]
    .node.Resources()
    ?.lookup(PDFName.of("XObject"), PDFDict);
  assert.equal(xobjects?.keys().length, 10);
  writeFileSync("tmp/pdfs/server-images.pdf", bytes);
  console.log(
    "PASS: ten real product photos are embedded in one A3 page by the deployed server;",
    bytes.length,
    "bytes;",
    Date.now() - start,
    "ms",
  );
} finally {
  await json("/sheets/" + id, "PATCH", {
    action: "delete",
    version: sheet.version,
    operation: crypto.randomUUID(),
  });
}
