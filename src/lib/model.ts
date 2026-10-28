import { z } from "zod";
export function validEan(value: string) {
  if (!/^(\d{8}|\d{13})$/.test(value)) return false;
  const digits = [...value].map(Number);
  const sum = digits
    .slice(0, -1)
    .reverse()
    .reduce((n, d, i) => n + d * (i % 2 === 0 ? 3 : 1), 0);
  return (10 - (sum % 10)) % 10 === digits.at(-1);
}
const obsPage = z
  .string()
  .url()
  .max(2048)
  .refine((value) => {
    try {
      const u = new URL(value);
      return (
        u.origin === "https://www.obsbygg.no" && !u.username && !u.password
      );
    } catch {
      return false;
    }
  }, "Ugyldig produktkilde");
export const productSchema = z.object({
  ean: z.string().refine(validEan),
  name: z.string().min(1).max(500),
  source: z.literal("Obs BYGG"),
  sourceUrl: obsPage,
  imageUrl: obsPage
    .refine((value) => {
      try {
        return /^\/globalassets\/(?:productimages|bilder|produktbilder)\/[^?#]+\.(?:jpe?g|png|webp)$/i.test(
          new URL(value).pathname,
        );
      } catch {
        return false;
      }
    }, "Ugyldig produktbilde")
    .optional(),
  fetchedAt: z.iso.datetime(),
});
export const lineSchema = z
  .object({
    id: z.string().uuid(),
    ean: z.string().refine(validEan, "Ugyldig EAN eller kontrollsiffer"),
    name: z.string().trim().min(1, "Skriv inn varenavn").max(500),
    quantity: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER),
    product: productSchema.optional(),
  })
  .refine(
    (line) => !line.product || line.product.ean === line.ean,
    "Produktet må tilhøre samme EAN som varelinjen.",
  );
export const bodySchema = z
  .object({
    title: z.string().trim().max(100),
    date: z.iso.date(),
    location: z.string().trim().max(120),
    lines: z.array(lineSchema).max(500),
  })
  .superRefine((body, ctx) => {
    const ids = new Set<string>(),
      eans = new Set<string>();
    for (const [i, line] of body.lines.entries()) {
      if (ids.has(line.id) || eans.has(line.ean))
        ctx.addIssue({
          code: "custom",
          message: "Samme EAN kan bare ha én varelinje.",
          path: ["lines", i],
        });
      ids.add(line.id);
      eans.add(line.ean);
    }
  });
export type Line = z.infer<typeof lineSchema>;
export type SheetBody = z.infer<typeof bodySchema>;
export type Sheet = {
  id: string;
  owner_id: string;
  body: SheetBody;
  state: "draft" | "locked";
  version: number;
  revision: number;
  created_at: string;
  updated_at: string;
  printed_at: string | null;
  delete_after: string | null;
};
export function osloDate(date: Date = new Date()) {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Oslo" }).format(
    date,
  );
}
export function emptyBody(): SheetBody {
  return { title: "", date: osloDate(), location: "", lines: [] };
}
export function dateLabel(value: string) {
  return value.split("-").reverse().join(".");
}
