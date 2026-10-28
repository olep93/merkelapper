import { requireUser, failure, checkOrigin, ApiError } from "@/lib/supabase";
import { bodySchema } from "@/lib/model";
import { z } from "zod";
export async function GET(request: Request) {
  try {
    const { db } = await requireUser();
    let query = db.from("merkelapp_sheets").select("*");
    if (new URL(request.url).searchParams.get("include_deleted") !== "1")
      query = query.is("deleted_at", null);
    const { data, error } = await query
      .order("updated_at", { ascending: false })
      .limit(200);
    if (error) throw error;
    return Response.json(data);
  } catch (e) {
    return failure(e);
  }
}
export async function POST(request: Request) {
  try {
    checkOrigin(request);
    const { db } = await requireUser();
    const parsed = z
      .object({ id: z.uuid(), operation: z.uuid(), body: bodySchema })
      .safeParse(await request.json());
    if (!parsed.success) throw new ApiError(parsed.error.issues[0].message);
    const p = parsed.data;
    const { data, error } = await db.rpc("merkelapp_write", {
      p_id: p.id,
      p_version: 0,
      p_operation: p.operation,
      p_action: "create",
      p_body: p.body,
    });
    if (error) throw error;
    return Response.json(data);
  } catch (e) {
    return failure(e);
  }
}
