import { requireUser, failure, ApiError } from "@/lib/supabase";
import { bodySchema } from "@/lib/model";
import { makePdf } from "@/lib/pdf";
export const maxDuration = 60;
export async function GET(
  _: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { db } = await requireUser();
    const { id } = await params;
    const { data: sheet } = await db
      .from("merkelapp_sheets")
      .select("id,state,revision")
      .eq("id", id)
      .single();
    if (!sheet) throw new ApiError("Fant ikke lappen.", 404);
    if (sheet.state !== "locked")
      throw new ApiError("Lås lappen før du åpner utskriften.", 409);
    const { data: revision } = await db
      .from("merkelapp_revisions")
      .select("body")
      .eq("sheet_id", id)
      .eq("revision", sheet.revision)
      .single();
    if (!revision) throw new ApiError("Fant ikke den låste revisjonen.", 404);
    const { bytes, pages, missingImages } = await makePdf(
      bodySchema.parse(revision.body),
      id,
      sheet.revision,
    );
    return new Response(Buffer.from(bytes), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="merkelapp-${id.slice(0, 8)}-r${sheet.revision}.pdf"`,
        "Cache-Control": "private, no-store",
        "X-Page-Count": String(pages),
        "X-Missing-Images": String(missingImages),
      },
    });
  } catch (e) {
    return failure(e);
  }
}
