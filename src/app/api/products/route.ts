import { z } from "zod";
import { validEan } from "@/lib/model";
import { lookupProduct, ProductSourceError } from "@/lib/products";
import { requireUser, checkOrigin, ApiError, failure } from "@/lib/supabase";
export const maxDuration = 15;
const requests = new Map<string, { start: number; count: number }>();
export async function POST(request: Request) {
  try {
    checkOrigin(request);
    const { user } = await requireUser();
    const parsed = z
      .object({ ean: z.string().refine(validEan) })
      .safeParse(await request.json());
    if (!parsed.success)
      throw new ApiError("Skriv en gyldig EAN-8 eller EAN-13.");
    const now = Date.now();
    for (const [id, r] of requests)
      if (now - r.start > 60_000) requests.delete(id);
    const rate = requests.get(user.id) || { start: now, count: 0 };
    rate.count++;
    requests.set(user.id, rate);
    if (rate.count > 30)
      return Response.json(
        {
          error:
            "Mange oppslag på kort tid. Vent litt, eller registrer varen manuelt.",
        },
        { status: 429, headers: { "Retry-After": "60" } },
      );
    try {
      return Response.json(await lookupProduct(parsed.data.ean), {
        headers: { "Cache-Control": "private, no-store" },
      });
    } catch (e) {
      if (e instanceof ProductSourceError)
        return Response.json({
          status: "unavailable",
          reason: e.reason,
          message: e.message,
        });
      throw e;
    }
  } catch (e) {
    return failure(e);
  }
}
