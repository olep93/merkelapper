import { createClient } from "@supabase/supabase-js";
import assert from "node:assert/strict";
process.loadEnvFile(".env.local");
const url = process.env.NEXT_PUBLIC_SUPABASE_URL,
  key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const admin = createClient(url, process.env.SUPABASE_SECRET_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const { data: probe, error: probeError } = await admin
  .from("merkelapp_sheets")
  .select("id")
  .limit(1);
if (probeError) throw probeError;
console.log("Database tables reachable");
const created = [];
try {
  const clients = [];
  for (let i = 0; i < 2; i++) {
    const email = `merkelapp-qa-${crypto.randomUUID()}@example.com`,
      password = crypto.randomUUID() + "aB7!";
    const {
      data: { user },
      error,
    } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      app_metadata: { apps: ["merkelapp"] },
    });
    if (error) throw error;
    created.push(user.id);
    const db = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { error: signError } = await db.auth.signInWithPassword({
      email,
      password,
    });
    if (signError) throw signError;
    clients.push(db);
  }
  const [a, b] = clients,
    id = crypto.randomUUID(),
    op = crypto.randomUUID();
  const body = {
    title: "Automatisk kvalitetstest",
    date: "2026-10-28",
    location: "",
    lines: [],
  };
  let { data: s, error } = await a.rpc("merkelapp_write", {
    p_id: id,
    p_version: 0,
    p_operation: op,
    p_action: "create",
    p_body: body,
  });
  if (error) throw error;
  assert.equal(s.version, 1);
  const retry = await a.rpc("merkelapp_write", {
    p_id: id,
    p_version: 0,
    p_operation: op,
    p_action: "create",
    p_body: body,
  });
  assert.equal(retry.data.version, 1);
  assert.equal(
    (await b.from("merkelapp_sheets").select("*").eq("id", id)).data.length,
    0,
  );
  assert.ok(
    (
      await b.rpc("merkelapp_write", {
        p_id: id,
        p_version: 1,
        p_operation: crypto.randomUUID(),
        p_action: "delete",
      })
    ).error,
  );
  const line = {
    id: crypto.randomUUID(),
    ean: "7025180735989",
    name: "Kellen skruesett 270 stk",
    quantity: 24,
  };
  body.lines = [line];
  const saved = await a.rpc("merkelapp_write", {
    p_id: id,
    p_version: 1,
    p_operation: crypto.randomUUID(),
    p_action: "save",
    p_body: body,
  });
  if (saved.error) throw saved.error;
  assert.equal(saved.data.version, 2);
  assert.ok(
    (
      await a.rpc("merkelapp_write", {
        p_id: id,
        p_version: 1,
        p_operation: crypto.randomUUID(),
        p_action: "save",
        p_body: body,
      })
    ).error.message.includes("version_conflict"),
  );
  assert.ok(
    (await a.from("merkelapp_sheets").update({ body }).eq("id", id)).error,
  );
  const lock = await a.rpc("merkelapp_write", {
    p_id: id,
    p_version: 2,
    p_operation: crypto.randomUUID(),
    p_action: "lock",
  });
  if (lock.error) throw lock.error;
  assert.equal(lock.data.revision, 1);
  assert.ok(
    (
      await a.rpc("merkelapp_write", {
        p_id: id,
        p_version: 3,
        p_operation: crypto.randomUUID(),
        p_action: "save",
        p_body: body,
      })
    ).error.message.includes("sheet_locked"),
  );
  const printed = await a.rpc("merkelapp_write", {
    p_id: id,
    p_version: 3,
    p_operation: crypto.randomUUID(),
    p_action: "printed",
  });
  if (printed.error) throw printed.error;
  assert.ok(
    Math.abs(
      new Date(printed.data.delete_after) -
        new Date(printed.data.printed_at) -
        7 * 86400000,
    ) < 1000,
  );
  const reopen = await a.rpc("merkelapp_write", {
    p_id: id,
    p_version: 4,
    p_operation: crypto.randomUUID(),
    p_action: "reopen",
  });
  if (reopen.error) throw reopen.error;
  assert.equal(reopen.data.delete_after, null);
  assert.equal(reopen.data.state, "draft");
  assert.equal(
    (await a.from("merkelapp_revisions").select("*").eq("sheet_id", id)).data
      .length,
    1,
  );
  assert.equal(
    (await b.from("merkelapp_revisions").select("*").eq("sheet_id", id)).data
      .length,
    0,
  );
  const bad = await a.rpc("merkelapp_write", {
    p_id: id,
    p_version: 5,
    p_operation: crypto.randomUUID(),
    p_action: "save",
    p_body: { ...body, lines: [{ ...line, ean: "1234567890123" }] },
  });
  assert.ok(bad.error.message.includes("invalid_body"));
  console.log(
    "PASS: server persistence, account isolation, idempotent create, conflict detection, direct-write protection, lock, immutable snapshot, print expiry, reopen, EAN validation",
  );
} finally {
  for (const id of created) {
    const { error } = await admin.auth.admin.deleteUser(id);
    if (error) throw error;
  }
  console.log("Disposable test accounts and sheets removed");
}
