import { readFileSync } from "node:fs";
import postgres from "postgres";
process.loadEnvFile(".env.local");
const connection =
  process.env.POSTGRES_URL_NON_POOLING || process.env.POSTGRES_URL;
if (!connection)
  throw new Error(
    "Sett POSTGRES_URL_NON_POOLING, eller kjør migreringene i Supabase SQL Editor.",
  );
const sql = postgres(connection, {
  ssl: "require",
  max: 1,
  connect_timeout: 12,
});
try {
  if (process.argv[2] === "migrate") {
    const path =
      process.argv[3] || "supabase/migrations/202610280001_merkelapp.sql";
    await sql.unsafe(readFileSync(path, "utf8"));
    console.log("Merkelapp migration applied:", path);
  }
  console.log(
    await sql`select extname from pg_extension where extname in ('pg_cron','pg_net')`,
  );
} finally {
  await sql.end();
}
