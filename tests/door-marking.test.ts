import { test } from "node:test";
import assert from "node:assert/strict";
import { doorDetails, readyToPrint } from "../src/lib/door-marking";
import { lookupFromObs, type ProductFetcher } from "../src/lib/products";

test("door dimensions preserve width/height and require explicit units and direction", () => {
  assert.deepEqual(doorDetails("90 X 210 CM H"), {
    width: "90",
    height: "210",
    handing: "H",
  });
  assert.deepEqual(doorDetails("800×2000 mm venstre"), {
    width: "80",
    height: "200",
    handing: "V",
  });
  assert.deepEqual(doorDetails("82,5 x 204 cm vendbar"), {
    width: "82.5",
    height: "204",
    handing: "Vendbar",
  });
  assert.deepEqual(doorDetails("9x21 H/V"), {
    width: "",
    height: "",
    handing: "",
  });
  assert.equal(doorDetails("90x210 CM").handing, "");
});
test("print validation requires EAN, direction, dimensions and bounded arguments", () => {
  const d = doorDetails("90x210 cm H");
  assert.equal(readyToPrint("7072354000770", "Dør", d, ["Isolert"]), true);
  for (const ean of ["7072354000771", ""])
    assert.equal(readyToPrint(ean, "Dør", d, ["Isolert"]), false);
  assert.equal(
    readyToPrint("7072354000770", "Dør", { ...d, handing: "" }, ["Isolert"]),
    false,
  );
  for (const width of ["-1", "0", "601", "1e2"])
    assert.equal(
      readyToPrint("7072354000770", "Dør", { ...d, width }, ["Isolert"]),
      false,
    );
  assert.equal(readyToPrint("7072354000770", "Dør", d, []), false);
  assert.equal(
    readyToPrint("7072354000770", "Dør", d, ["x".repeat(181)]),
    false,
  );
});
test("size and arguments belong to the verified EAN, not a sibling variant", async () => {
  const ean = "7072354000770",
    url = "/dor/ytterdorer/2360609";
  const fake: ProductFetcher = async (u) =>
    u.includes("autocomplete")
      ? Response.json({
          products: [
            {
              ean,
              variationCode: `ObsBygg-${ean}`,
              url,
              productUsps: ["63 mm tykkelse", "5 års formgaranti"],
            },
          ],
        })
      : new Response(
          `<script type="application/ld+json">${JSON.stringify({
            "@type": "ProductGroup",
            hasVariant: [
              {
                "@type": "Product",
                sku: "ObsBygg-7072354000824",
                name: "Dør",
                size: "80 X 200 CM V",
              },
              {
                "@type": "Product",
                sku: `ObsBygg-${ean}`,
                name: "Dør",
                size: "90 X 190 CM H",
              },
            ],
          })}</script>`,
        );
  const result = await lookupFromObs(ean, fake);
  assert.equal(result.status, "found");
  if (result.status !== "found") return;
  assert.equal(result.product.size, "90 X 190 CM H");
  assert.deepEqual(result.product.sellingPoints, [
    "63 mm tykkelse",
    "5 års formgaranti",
  ]);
  const mismatch: ProductFetcher = async (u, o) =>
    u.includes("autocomplete")
      ? Response.json({
          products: [
            {
              ean: "7072354000824",
              variationCode: "ObsBygg-7072354000824",
              url,
              productUsps: ["Feil variant"],
            },
          ],
        })
      : fake(u, o);
  const other = await lookupFromObs(ean, mismatch);
  assert.equal(other.status, "found");
  if (other.status === "found")
    assert.equal(other.product.sellingPoints, undefined);
});
