import { test } from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import bwip from "bwip-js/node";
import { PDFDocument, PDFName, PDFDict } from "pdf-lib";
import {
  preparePrintImage,
  type PrintImageLoader,
} from "../src/lib/print-images";
import { makePdf } from "../src/lib/pdf";
import { fonts, planPages } from "../src/lib/layout";
import type { Line } from "../src/lib/model";
const url = "https://www.obsbygg.no/globalassets/productimages/test.jpg";
const product = {
  ean: "7025180735989",
  name: "Kellen skruesett utendørs 270 stk",
  source: "Obs BYGG" as const,
  sourceUrl: "https://www.obsbygg.no/verktoy/1234567",
  imageUrl: url,
  fetchedAt: new Date().toISOString(),
};
const line = (): Line => ({
  id: crypto.randomUUID(),
  ean: product.ean,
  name: product.name,
  quantity: 24,
  product,
});
test("photographs reserve real space without shrinking barcodes; 12 lines balance 6 + 6", async () => {
  const { font, bold } = await fonts();
  for (const n of [1, 3, 10, 12, 20, 40]) {
    const rows = Array.from({ length: n }, line);
    const p = planPages(rows, font, bold);
    if (n === 10) assert.equal(p.length, 1);
    if (n === 12)
      assert.deepEqual(
        p.map((x) => x.rows.length),
        [6, 6],
      );
    for (const row of p.flatMap((x) => x.rows)) {
      assert.ok(row.imageSize > 0);
      assert.ok(row.height >= row.imageSize + 12);
      assert.ok(row.nameSize >= 18);
      assert.ok(row.eanSize >= 16);
      assert.ok(row.quantitySize >= 36);
    }
  }
});
test("print preparation detects and covers a competing barcode in a product photo", async () => {
  const bytes = await bwip.toBuffer({
    bcid: "ean13",
    text: "3253560306977",
    scale: 4,
    height: 30,
    padding: 30,
    backgroundcolor: "FFFFFF",
  });
  const prepared = await preparePrintImage(bytes);
  assert.ok(prepared.masks.length > 0);
  assert.ok(prepared.masks[0].width > 0);
  assert.ok(prepared.width <= 800);
  assert.ok(prepared.height <= 800);
});
test("PDF embeds a real photo and reports unavailable photos without blocking the print", async () => {
  const bytes = await sharp({
    create: { width: 80, height: 80, channels: 3, background: "#4f77a5" },
  })
    .jpeg()
    .toBuffer();
  const image = await preparePrintImage(bytes),
    imageLoader: PrintImageLoader = async () => new Map([[url, image]]);
  const body = { title: "", date: "2026-10-28", location: "", lines: [line()] };
  const rendered = await makePdf(body, crypto.randomUUID(), 1, { imageLoader });
  assert.equal(rendered.missingImages, 0);
  const pdf = await PDFDocument.load(rendered.bytes);
  assert.equal(pdf.getPageCount(), 1);
  const xobjects = pdf
    .getPages()[0]
    .node.Resources()
    ?.lookup(PDFName.of("XObject"), PDFDict);
  assert.equal(
    xobjects?.keys().length,
    1,
    "the page must draw the embedded image",
  );
  assert.ok(Buffer.from(rendered.bytes).length > bytes.length);
  const fallback = await makePdf(body, crypto.randomUUID(), 1, {
    imageLoader: async () => new Map(),
  });
  assert.equal(fallback.missingImages, 1);
  assert.equal((await PDFDocument.load(fallback.bytes)).getPageCount(), 1);
});
