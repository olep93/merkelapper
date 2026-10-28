import { readFile, writeFile, mkdir } from "node:fs/promises";
import bwip from "bwip-js/node";
import { makePdf } from "../src/lib/pdf";
import { preparePrintImage } from "../src/lib/print-images";
import type { Product } from "../src/lib/products";
async function main() {
  await mkdir("tmp/pdfs", { recursive: true });
  const products = JSON.parse(
    await readFile("tmp/obsbygg/verified-products.json", "utf8"),
  ) as Product[];
  const lines = products.map((p, i) => ({
    id: crypto.randomUUID(),
    ean: p.ean,
    name: p.name,
    quantity: (i + 1) * 12,
    product: p,
  }));
  const body = { title: "Bildetest", date: "2026-10-28", location: "", lines };
  const result = await makePdf(body, "12345678-0000-4000-8000-000000000000", 1);
  await writeFile("tmp/pdfs/10-varer-bilder.pdf", result.bytes);
  console.log(
    "10 real images:",
    result.pages,
    "pages;",
    result.missingImages,
    "missing;",
    result.maskedImages,
    "photos with masked codes;",
    result.bytes.length,
    "bytes",
  );
  const competing = await preparePrintImage(
    await bwip.toBuffer({
      bcid: "ean13",
      text: "3253560306977",
      scale: 4,
      height: 30,
      padding: 30,
      backgroundcolor: "FFFFFF",
    }),
  );
  const imageUrl = lines[0].product.imageUrl!;
  const safe = await makePdf(
    { ...body, lines: [lines[0]] },
    "12345678-0000-4000-8000-000000000000",
    1,
    { imageLoader: async () => new Map([[imageUrl, competing]]) },
  );
  await writeFile("tmp/pdfs/barcode-in-photo.pdf", safe.bytes);
  console.log("Competing barcode fixture:", safe.maskedImages, "masked");
}
main();
