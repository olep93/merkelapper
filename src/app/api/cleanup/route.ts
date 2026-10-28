import { timingSafeEqual } from "node:crypto";
import { adminClient } from "@/lib/supabase";
export async function GET(request: Request) {
  const expected = `Bearer ${process.env.CRON_SECRET || ""}`,
    actual = request.headers.get("authorization") || "";
  if (
    !process.env.CRON_SECRET ||
    actual.length !== expected.length ||
    !timingSafeEqual(Buffer.from(expected), Buffer.from(actual))
  )
    return new Response("Unauthorized", { status: 401 });
  const { data, error } = await adminClient()
    .from("merkelapp_sheets")
    .delete()
    .lte("delete_after", new Date().toISOString())
    .select("id");
  return Response.json(
    error ? { error: "Cleanup failed" } : { deleted: data?.length || 0 },
    { status: error ? 500 : 200 },
  );
}
