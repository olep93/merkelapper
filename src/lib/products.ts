import { validEan } from "./model";
export const OBS_ORIGIN = "https://www.obsbygg.no";
export type Product = {
  ean: string;
  name: string;
  source: "Obs BYGG";
  sourceUrl: string;
  imageUrl?: string;
  fetchedAt: string;
};
export type LookupResult =
  | { status: "found"; product: Product }
  | { status: "ambiguous"; products: Product[] }
  | { status: "not_found" };
type JsonObject = Record<string, unknown>;
const object = (value: unknown): value is JsonObject =>
  !!value && typeof value === "object" && !Array.isArray(value);
export function obsUrl(value: unknown, image = false): string | undefined {
  if (typeof value !== "string" || value.length > 2048) return;
  try {
    const u = new URL(value, OBS_ORIGIN);
    if (u.origin !== OBS_ORIGIN || u.username || u.password) return;
    if (
      image &&
      !/^\/globalassets\/(?:productimages|bilder|produktbilder)\/[^?#]+\.(?:jpe?g|png|webp)$/i.test(
        u.pathname,
      )
    )
      return;
    if (
      !image &&
      (u.pathname === "/" ||
        /^\/(?:sok|innlogging|kassen)(?:\/|$)/i.test(u.pathname))
    )
      return;
    u.hash = "";
    return u.href;
  } catch {
    return;
  }
}
function imageUrl(value: unknown): string | undefined {
  if (Array.isArray(value)) {
    for (const v of value) {
      const url = imageUrl(v);
      if (url) return url;
    }
    return;
  }
  return obsUrl(object(value) ? value.url || value.contentUrl : value, true);
}
function exactIdentity(node: JsonObject, ean: string) {
  const known: string[] = [];
  for (const key of ["gtin", "gtin8", "gtin13"])
    if (typeof node[key] === "string" && validEan(node[key] as string))
      known.push(node[key] as string);
  if (
    typeof node.sku === "string" &&
    /^ObsBygg-(?:\d{8}|\d{13})$/.test(node.sku)
  )
    known.push(node.sku.slice(8));
  return known.length > 0 && known.every((value) => value === ean);
}
function productName(node: JsonObject, parent?: JsonObject) {
  const base =
    typeof node.name === "string"
      ? node.name
      : typeof parent?.name === "string"
        ? parent.name
        : "";
  if (!base.trim() || base.length > 420) return;
  const parts = [base.normalize("NFC").replace(/\s+/g, " ").trim()];
  const normal = (s: string) =>
    s
      .normalize("NFC")
      .toLocaleLowerCase("nb")
      .replace(/[^\p{L}\p{N}]/gu, "");
  for (const key of ["size", "color"]) {
    const v = node[key];
    if (
      typeof v === "string" &&
      v.trim() &&
      v.length < 80 &&
      !normal(parts.join(" ")).includes(normal(v))
    )
      parts.push(v.normalize("NFC").replace(/\s+/g, " ").trim());
  }
  const name = parts.join(" · ");
  return name.length <= 500 ? name : undefined;
}
/** A search hit is only a candidate. Accept identity from explicit GTIN/ObsBygg SKU on the product page. */
export function productsFromHtml(
  html: string,
  ean: string,
  pageUrl: string,
): Product[] {
  const matches: Product[] = [];
  function visit(value: unknown, parent?: JsonObject) {
    if (Array.isArray(value)) {
      for (const child of value) visit(child, parent);
      return;
    }
    if (!object(value)) return;
    const types = Array.isArray(value["@type"])
      ? value["@type"]
      : [value["@type"]];
    if (types.includes("Product") && exactIdentity(value, ean)) {
      const name = productName(value, parent),
        url = obsUrl(value.url) || obsUrl(pageUrl);
      if (name && url) {
        const source = new URL(url);
        source.searchParams.set("v", `ObsBygg-${ean}`);
        const image = imageUrl(value.image) || imageUrl(parent?.image);
        matches.push({
          ean,
          name,
          source: "Obs BYGG",
          sourceUrl: source.href,
          ...(image ? { imageUrl: image } : {}),
          fetchedAt: new Date().toISOString(),
        });
      }
    }
    for (const key of ["hasVariant", "@graph", "mainEntity"])
      if (value[key]) visit(value[key], value);
  }
  for (const m of html.matchAll(
    /<script\b[^>]*\btype\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script\s*>/gi,
  )) {
    try {
      visit(JSON.parse(m[1]));
    } catch {
      /* A malformed or unrelated script cannot establish product identity. */
    }
  }
  return [
    ...new Map(matches.map((p) => [p.sourceUrl + "|" + p.name, p])).values(),
  ];
}
export class ProductSourceError extends Error {
  constructor(public reason: "timeout" | "upstream") {
    super(
      reason === "timeout"
        ? "Obs BYGG brukte for lang tid. Du kan registrere varen manuelt."
        : "Produktoppslaget er midlertidig utilgjengelig. Du kan registrere varen manuelt.",
    );
  }
}
export type ProductFetcher = (
  url: string,
  options: RequestInit,
) => Promise<Response>;
export async function lookupFromObs(
  ean: string,
  fetcher: ProductFetcher = fetch,
): Promise<LookupResult> {
  if (!validEan(ean)) throw new Error("Invalid EAN");
  const signal = AbortSignal.timeout(8000);
  const get = async (url: string, accept: string) => {
    const response = await fetcher(url, {
      signal,
      cache: "no-store",
      redirect: "error",
      headers: {
        Accept: accept,
        "User-Agent": "MerkelappTest/0.2 (+https://jobbverktoy.no/merkelapp)",
      },
    });
    if (!response.ok) throw new ProductSourceError("upstream");
    return response;
  };
  try {
    // Public autocomplete used by Obs BYGG's own search UI; not an official, contracted product API.
    const search = new URL("/sok/autocomplete", OBS_ORIGIN);
    search.searchParams.set("q", ean);
    search.searchParams.set("count", "4");
    search.searchParams.set("track", "false");
    const payload: unknown = await (
      await get(search.href, "application/json")
    ).json();
    if (!object(payload) || !Array.isArray(payload.products))
      throw new ProductSourceError("upstream");
    const candidates = payload.products.filter(object);
    const exact = candidates.filter(
      (p) => p.variationCode === `ObsBygg-${ean}`,
    );
    const urls = [
      ...new Set(
        (exact.length ? exact : candidates)
          .map((p) => obsUrl(p.url))
          .filter((url): url is string => !!url),
      ),
    ].slice(0, 4);
    if (!urls.length) return { status: "not_found" };
    const resolved = await Promise.allSettled(
      urls.map(async (url) =>
        productsFromHtml(await (await get(url, "text/html")).text(), ean, url),
      ),
    );
    const products = [
      ...new Map(
        resolved
          .flatMap((r) => (r.status === "fulfilled" ? r.value : []))
          .map((p) => [p.sourceUrl + "|" + p.name, p]),
      ).values(),
    ];
    if (!products.length) {
      if (resolved.some((r) => r.status === "rejected"))
        throw new ProductSourceError(signal.aborted ? "timeout" : "upstream");
      return { status: "not_found" };
    }
    if (products.length > 1) return { status: "ambiguous", products };
    return { status: "found", product: products[0] };
  } catch (e) {
    if (e instanceof ProductSourceError) throw e;
    throw new ProductSourceError(signal.aborted ? "timeout" : "upstream");
  }
}
// Store only the minimal verified name/image/source, never upstream price/stock responses.
const cache = new Map<string, { expires: number; result: LookupResult }>();
const pending = new Map<string, Promise<LookupResult>>();
export async function lookupProduct(ean: string): Promise<LookupResult> {
  const cached = cache.get(ean);
  if (cached && cached.expires > Date.now()) return cached.result;
  const existing = pending.get(ean);
  if (existing) return existing;
  if (pending.size >= 16) throw new ProductSourceError("upstream");
  const promise = lookupFromObs(ean)
    .then((result) => {
      if (cache.size >= 500) cache.delete(cache.keys().next().value!);
      cache.set(ean, {
        expires:
          Date.now() +
          (result.status === "not_found" ? 5 * 60_000 : 4 * 60 * 60_000),
        result,
      });
      return result;
    })
    .finally(() => pending.delete(ean));
  pending.set(ean, promise);
  return promise;
}
