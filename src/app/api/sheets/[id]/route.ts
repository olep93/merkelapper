import { requireUser, failure, checkOrigin, ApiError } from "@/lib/supabase";
import { bodySchema } from "@/lib/model";
import { z } from "zod";
export async function GET(
  _: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { db } = await requireUser();
    const { id } = await params;
    const { data, error } = await db
      .from("merkelapp_sheets")
      .select("*")
      .eq("id", id)
      .single();
    if (error || !data) throw new ApiError("Fant ikke lappen.", 404);
    return Response.json(data);
  } catch (e) {
    return failure(e);
  }
}
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    checkOrigin(request);
    const { db } = await requireUser();
    const { id } = await params;
    const parsed = z
      .object({
        action: z.enum(["save", "lock", "reopen", "printed", "delete"]),
        version: z.number().int().min(1),
        operation: z.uuid(),
        body: bodySchema.optional(),
      })
      .safeParse(await request.json());
    if (!parsed.success) throw new ApiError(parsed.error.issues[0].message);
    const p = parsed.data;
    if (p.action === "save" && !p.body) throw new ApiError("Innhold mangler.");
    const { data, error } = await db.rpc("merkelapp_write", {
      p_id: id,
      p_version: p.version,
      p_operation: p.operation,
      p_action: p.action,
      p_body: p.body || null,
    });
    if (error) {
      if (error.message.includes("version_conflict"))
        throw new ApiError(
          "Lappen er endret på en annen enhet. Last inn siste lagrede versjon før du fortsetter.",
          409,
        );
      if (error.message.includes("not_found"))
        throw new ApiError("Fant ikke lappen.", 404);
      if (error.message.includes("sheet_locked"))
        throw new ApiError(
          "Lappen er låst. Åpne den for redigering først.",
          409,
        );
      throw error;
    }
    return Response.json(data);
  } catch (e) {
    return failure(e);
  }
}
