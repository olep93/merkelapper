import { selectedPage } from "./obs-selected-fixture";
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  productsFromHtml,
  lookupFromObs,
  obsUrl,
  ProductSourceError,
  type ProductFetcher,
} from "../src/lib/products";
import { lineSchema } from "../src/lib/model";
const ean = "7025180735989",
  other = "3253560306977";
const page = "https://www.obsbygg.no/verktoy/1234567";
const image = "/globalassets/productimages/example.jpg?ref=abc";
const html = (value: unknown) =>
  `<script type="application/ld+json">${JSON.stringify(value)}</script>` +
  selectedPage(ean);
const group = (variants: unknown[]) => ({
  "@type": "ProductGroup",
  name: "Kellen skruesett",
  hasVariant: variants,
});
const variant = (code = ean) => ({
  "@type": "Product",
  sku: `ObsBygg-${code}`,
  name: "Kellen skruesett",
  size: "270 STK",
  image,
  url: page,
});
test("accepts only explicit matching product identity, never a raw EAN elsewhere in HTML", () => {
  assert.equal(
    productsFromHtml(html(group([variant(other)])) + `EAN ${ean}`, ean, page)
      .length,
    0,
  );
  const [p] = productsFromHtml(html(group([variant()])), ean, page);
  assert.equal(p.ean, ean);
  assert.equal(p.name, "Kellen skruesett · 270 STK");
  assert.equal(p.imageUrl, "https://www.obsbygg.no" + image);
  assert.ok(p.sourceUrl.endsWith("?v=ObsBygg-" + ean));
});
test("selects the right packaging variant and rejects conflicting identities", () => {
  const [p] = productsFromHtml(
    html(group([{ ...variant(other), size: "10 PK" }, variant()])),
    ean,
    page,
  );
  assert.equal(p.ean, ean);
  assert.ok(p.name.includes("270 STK"));
  assert.equal(
    productsFromHtml(html({ ...variant(), gtin13: other }), ean, page).length,
    0,
  );
});
test("no image, malformed data and duplicate structured scripts are safe", () => {
  const noImage = { ...variant(), image: undefined };
  assert.equal(
    productsFromHtml(html(noImage), ean, page)[0].imageUrl,
    undefined,
  );
  assert.equal(
    productsFromHtml(
      '<script type="application/ld+json">broken</script>',
      ean,
      page,
    ).length,
    0,
  );
  assert.equal(
    productsFromHtml(
      html(variant()) +
        `<script type="application/ld+json">${JSON.stringify(variant())}</script>`,
      ean,
      page,
    ).length,
    1,
  );
});
test("rejects external, executable and non-product image URLs", () => {
  for (const value of [
    "javascript:alert(1)",
    "https://evil.example/image.jpg",
    "https://www.obsbygg.no@evil.example/a.jpg",
    "https://www.obsbygg.no/globalassets/productimages/a.svg",
    "//localhost/a.jpg",
  ])
    assert.equal(obsUrl(value, true), undefined);
  const product = productsFromHtml(html(variant()), ean, page)[0];
  const line = {
    id: crypto.randomUUID(),
    ean,
    name: "Mitt eget navn",
    quantity: 2,
    product,
  };
  assert.equal(lineSchema.safeParse(line).success, true);
  assert.equal(lineSchema.safeParse({ ...line, ean: other }).success, false);
  assert.equal(
    lineSchema.safeParse({
      ...line,
      product: { ...product, imageUrl: "not a URL" },
    }).success,
    false,
  );
  assert.equal(
    lineSchema.safeParse({
      ...line,
      product: { ...product, sourceUrl: "https://evil.example" },
    }).success,
    false,
  );
});
test("search candidates are verified against the product page before acceptance", async () => {
  const calls: string[] = [];
  const fetcher: ProductFetcher = async (url) => {
    calls.push(url);
    return url.includes("/sok/autocomplete")
      ? Response.json({
          products: [{ variationCode: `ObsBygg-${ean}`, url: page }],
        })
      : new Response(html(group([variant()])));
  };
  const result = await lookupFromObs(ean, fetcher);
  assert.equal(result.status, "found");
  assert.equal(calls.length, 2);
  assert.ok(calls[0].includes("track=false"));
  assert.equal(new URL(calls[1]).searchParams.get("v"), `ObsBygg-${ean}`);
  const mismatch: ProductFetcher = async (url) =>
    url.includes("/sok/autocomplete")
      ? Response.json({
          products: [{ variationCode: `ObsBygg-${ean}`, url: page }],
        })
      : new Response(html(variant(other)));
  assert.equal((await lookupFromObs(ean, mismatch)).status, "not_found");
});
test("no hits differ from an upstream failure and ambiguous identity requires confirmation", async () => {
  assert.equal(
    (await lookupFromObs(ean, async () => Response.json({ products: [] })))
      .status,
    "not_found",
  );
  await assert.rejects(
    lookupFromObs(ean, async () => new Response("", { status: 429 })),
    ProductSourceError,
  );
  const multiple: ProductFetcher = async (url) =>
    url.includes("/sok/autocomplete")
      ? Response.json({ products: [{ url: page }] })
      : new Response(
          html(group([variant(), { ...variant(), name: "Annet varenavn" }])),
        );
  assert.equal((await lookupFromObs(ean, multiple)).status, "ambiguous");
});

test("normalizes decomposed Norwegian characters so the fetched name prints correctly", () => {
  const [p] = productsFromHtml(
    html({
      ...variant(),
      name: "Stanley ma\u030aleba\u030and",
      size: undefined,
    }),
    ean,
    page,
  );
  assert.equal(p.name, "Stanley målebånd");
});

test("a sibling EAN in JSON-LD never verifies the page's selected article", () => {
  const ld = `<script type="application/ld+json">${JSON.stringify(group([variant(), variant(other)]))}</script>`;
  assert.equal(productsFromHtml(ld, ean, page).length, 0);
  assert.equal(productsFromHtml(ld + selectedPage(other), ean, page).length, 0);
  const wrongArticle = selectedPage(ean).replace(
    `<td>${ean}</td>`,
    `<td>${other}</td>`,
  );
  assert.equal(productsFromHtml(ld + wrongArticle, ean, page).length, 0);
});
test("selected size, active article and structured variant must all agree", () => {
  const size = "90 X 210 CM H";
  const ld = `<script type="application/ld+json">${JSON.stringify({ ...variant(), size })}</script>`;
  const selected = selectedPage(ean, size);
  assert.equal(
    productsFromHtml(ld + selected, ean, page)[0].selectedVariantVerified,
    true,
  );
  assert.equal(
    productsFromHtml(
      ld +
        selected.replace(`<span>${size}</span>`, "<span>90 X 210 CM V</span>"),
      ean,
      page,
    ).length,
    0,
  );
  assert.equal(
    productsFromHtml(ld + selectedPage(ean, "100 X 210 CM H"), ean, page)
      .length,
    0,
  );
  assert.equal(
    productsFromHtml(
      ld + selected.replace("<h4>", "<div>").replace("</h4>", "</div>"),
      ean,
      page,
    ).length,
    0,
  );
  const stored = lineSchema.parse({
    id: crypto.randomUUID(),
    ean,
    name: "Dør",
    quantity: 1,
    product: productsFromHtml(ld + selected, ean, page)[0],
  });
  assert.equal(stored.product?.size, size);
  assert.equal(stored.product?.selectedVariantVerified, true);
});
test("lookup overrides a search link's default variant before loading the product", async () => {
  const fetcher: ProductFetcher = async (url) => {
    if (url.includes("autocomplete"))
      return Response.json({
        products: [{ url: page + `?v=ObsBygg-${other}` }],
      });
    assert.equal(new URL(url).searchParams.get("v"), `ObsBygg-${ean}`);
    return new Response(html(variant()));
  };
  assert.equal((await lookupFromObs(ean, fetcher)).status, "found");
});

test("accepts the JFIF photos used by Ask doors and preserves the source validation", () => {
  const imageUrl =
    "https://www.obsbygg.no/globalassets/productimages/ask.jfif?ref=test";
  assert.equal(obsUrl(imageUrl, true), imageUrl);
  const p = productsFromHtml(
    html({ ...variant(), image: imageUrl }),
    ean,
    page,
  )[0];
  assert.equal(
    lineSchema.safeParse({
      id: crypto.randomUUID(),
      ean,
      name: p.name,
      quantity: 1,
      product: p,
    }).success,
    true,
  );
  assert.equal(
    obsUrl("https://evil.example/globalassets/productimages/ask.jfif", true),
    undefined,
  );
});
test("products without a size selector still require the landed article and active EAN", () => {
  const selected = selectedPage(ean).replace(
    '"sizeVariations":[]',
    `"sizeVariations":[{"displayName":null,"code":"ObsBygg-${ean}"}]`,
  );
  const ld = `<script type="application/ld+json">${JSON.stringify({ ...variant(), size: undefined })}</script>`;
  assert.equal(productsFromHtml(ld + selected, ean, page).length, 1);
  assert.equal(
    productsFromHtml(
      ld + selected.replace(`<td>${ean}</td>`, `<td>${other}</td>`),
      ean,
      page,
    ).length,
    0,
  );
});
