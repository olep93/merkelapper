import { lookupFromObs } from "../src/lib/products";
import { readFile, writeFile } from "node:fs/promises";
async function main() {
  const doc = await readFile("Varetellingslapper_Jobbverktoy_Codex.md", "utf8");
  const eans = [
    ...new Set([...doc.matchAll(/\|\s*(\d{13})\s*\|/g)].map((m) => m[1])),
  ];
  const results = [];
  for (const ean of eans) {
    const start = Date.now(),
      result = await lookupFromObs(ean);
    if (result.status !== "found")
      throw new Error(`No verified result for ${ean}: ${result.status}`);
    const p = result.product;
    let imageStatus = "missing";
    if (p.imageUrl) {
      const response = await fetch(p.imageUrl, {
        method: "HEAD",
        signal: AbortSignal.timeout(8000),
        redirect: "error",
      });
      if (
        !response.ok ||
        !response.headers.get("content-type")?.startsWith("image/")
      )
        throw new Error(`Image unavailable for ${ean}`);
      imageStatus = "200";
    }
    console.log(ean, p.name, `image=${imageStatus}`, `${Date.now() - start}ms`);
    results.push(p);
  }
  await writeFile(
    "tmp/obsbygg/verified-products.json",
    JSON.stringify(results, null, 2),
  );
  console.log(
    `PASS: ${results.length} exact EANs verified against Obs BYGG product-page variants and image responses`,
  );
}
main();
