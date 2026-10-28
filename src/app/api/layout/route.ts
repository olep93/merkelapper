import { requireUser, failure, checkOrigin, ApiError } from "@/lib/supabase";
import { bodySchema } from "@/lib/model";
import { fonts, planPages } from "@/lib/layout";
export async function POST(request: Request) {
  try {
    checkOrigin(request);
    await requireUser();
    const result = bodySchema.safeParse(await request.json());
    if (!result.success) throw new ApiError("Kontroller varelinjene.");
    const { font, bold } = await fonts();
    const pages = planPages(result.data.lines, font, bold);
    return Response.json({
      pages: pages.map((p) => ({
        nameWidth: p.nameWidth,
        quantityWidth: p.quantityWidth,
        count: p.rows.length,
        fontSize: p.rows[0]?.nameSize || 18,
        lines: p.rows.map((r) => ({
          id: r.line.id,
          nameLines: r.nameLines,
          nameSize: r.nameSize,
          eanSize: r.eanSize,
          quantitySize: r.quantitySize,
          height: r.height,
        })),
      })),
    });
  } catch (e) {
    return failure(e);
  }
}
