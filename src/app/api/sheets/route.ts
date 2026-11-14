import { requireUser, failure, checkOrigin, ApiError } from "@/lib/supabase";
import { storeForNewSheet } from "@/lib/area";
import { bodySchema } from "@/lib/model";
import { z } from "zod";
export async function GET(request: Request) {
  try {
    const { db } = await requireUser();
    const params = new URL(request.url).searchParams;
    let query = db.from("merkelapp_sheets").select("*");
    if (params.get("include_deleted") !== "1")
      query = query.is("deleted_at", null);
    // The door book is one private record per account, kept apart from the sheet lists.
    query =
      params.get("doors") === "1"
        ? query.eq("body->>kind", "doors")
        : query.or("body->>kind.is.null,body->>kind.neq.doors");
    const { data, error } = await query
      .order("updated_at", { ascending: false })
      .limit(500);
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
      .object({
        id: z.uuid(),
        operation: z.uuid(),
        body: bodySchema,
        store: z.uuid().optional(),
      })
      .safeParse(await request.json());
    if (!parsed.success) throw new ApiError(parsed.error.issues[0].message);
    const p = parsed.data;
    let stores: { id: string }[] = [];
    if (p.body.kind && !p.store) {
      const mine = await db.rpc("merkelapp_my_stores");
      if (mine.error) throw mine.error;
      stores = mine.data;
    }
    const { data, error } = await db.rpc("merkelapp_write", {
      p_id: p.id,
      p_version: 0,
      p_operation: p.operation,
      p_action: "create",
      p_body: p.body,
      p_store: storeForNewSheet(p.body, p.store, stores) ?? null,
    });
    if (error) {
      if (error.message.includes("store_denied"))
        throw new ApiError("Du har ikke tilgang til dette varehuset.", 403);
      throw error;
    }
    return Response.json(data);
  } catch (e) {
    return failure(e);
  }
}
