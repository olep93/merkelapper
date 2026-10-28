import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
process.loadEnvFile(".env.local");
const base = process.argv[2];
if (!base) throw new Error("Oppgi appens eller portalens URL.");
const qa = JSON.parse(readFileSync(".qa-account.json", "utf8"));
const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY,
  { auth: { persistSession: false } },
);
const user = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  { auth: { persistSession: false } },
);
const { error } = await user.auth.signInWithPassword(qa);
if (error) throw error;
const id = crypto.randomUUID(),
  body = {
    title: "Disposable expiry check",
    date: "2026-10-28",
    location: "",
    lines: [],
  };
const { error: createError } = await admin
  .from("merkelapp_sheets")
  .insert({
    id,
    owner_id: qa.id,
    body,
    delete_after: new Date(Date.now() - 60000).toISOString(),
  });
if (createError) throw createError;
try {
  assert.equal(
    (await user.from("merkelapp_sheets").select("id").eq("id", id)).data.length,
    0,
    "expired sheets must be hidden before cron",
  );
  assert.equal((await fetch(base + "/merkelapp/api/cleanup")).status, 401);
  const result = await fetch(base + "/merkelapp/api/cleanup", {
    headers: { Authorization: "Bearer " + process.env.CRON_SECRET },
  });
  assert.equal(result.status, 200, await result.text());
  const { data, error } = await admin
    .from("merkelapp_sheets")
    .select("id")
    .eq("id", id);
  if (error) throw error;
  assert.equal(data.length, 0);
  console.log(
    "PASS: expired sheets are immediately hidden, cleanup rejects unauthenticated calls, scheduled cleanup physically removes expired sheets",
  );
} finally {
  await admin.from("merkelapp_sheets").delete().eq("id", id);
}
