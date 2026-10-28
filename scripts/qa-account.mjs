import { createClient } from "@supabase/supabase-js";
import { writeFileSync, readFileSync, unlinkSync } from "node:fs";
process.loadEnvFile(".env.local");
const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY,
  { auth: { persistSession: false } },
);
if (process.argv[2] === "remove") {
  const p = JSON.parse(readFileSync(".qa-account.json", "utf8"));
  const { error } = await admin.auth.admin.deleteUser(p.id);
  if (error) throw error;
  unlinkSync(".qa-account.json");
  console.log("QA account removed");
} else {
  const email = `merkelapp-ui-${crypto.randomUUID()}@example.com`,
    password = crypto.randomUUID() + "aB7!";
  const {
    data: { user },
    error,
  } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { display_name: "Kvalitetstest" },
    app_metadata: { apps: ["merkelapp"] },
  });
  if (error) throw error;
  writeFileSync(
    ".qa-account.json",
    JSON.stringify({ email, password, id: user.id }),
    { mode: 0o600 },
  );
  console.log("Disposable UI account ready");
}
