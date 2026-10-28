import { test } from "node:test";
import assert from "node:assert/strict";
import { fonts, planPages, ROW_SPACE, MM } from "../src/lib/layout";
import { validEan, bodySchema, type Line } from "../src/lib/model";
import { makePdf, eanBits } from "../src/lib/pdf";
import { PDFDocument } from "pdf-lib";
const normal = (count: number): Line[] =>
  Array.from({ length: count }, (_, i) => ({
    id: crypto.randomUUID(),
    ean: i % 2 ? "3253560306977" : "7025180735989",
    name:
      i % 2
        ? "Stanley målebånd 5 m / 0-30-697"
        : "Kellen skruesett utendørs 270 stk",
    quantity: i + 1,
  }));
test("EAN validates checksums and preserves leading zeros", () => {
  assert.equal(validEan("7025180735989"), true);
  assert.equal(validEan("7025180735980"), false);
  assert.equal(validEan("96385074"), true);
  assert.equal(validEan("0123456789012"), true);
  assert.equal(validEan("123"), false);
});
test("quantities are safe nonnegative integers", () => {
  const body = {
    title: "",
    date: "2026-10-28",
    location: "",
    lines: normal(1),
  };
  for (const n of [-1, 1.5, NaN, Number.MAX_SAFE_INTEGER + 1])
    assert.equal(
      bodySchema.safeParse({
        ...body,
        lines: [{ ...body.lines[0], quantity: n }],
      }).success,
      false,
    );
  assert.equal(
    bodySchema.safeParse({
      ...body,
      lines: [{ ...body.lines[0], quantity: 0 }],
    }).success,
    true,
  );
});
test("ten ordinary products fit one A3 page; twelve balance six and six", async () => {
  const { font, bold } = await fonts();
  assert.deepEqual(
    planPages(normal(10), font, bold).map((p) => p.rows.length),
    [10],
  );
  assert.deepEqual(
    planPages(normal(12), font, bold).map((p) => p.rows.length),
    [6, 6],
  );
});
test("fewer products have larger text, pagination preserves all rows and order", async () => {
  const { font, bold } = await fonts();
  assert.ok(
    planPages(normal(3), font, bold)[0].rows[0].nameSize >
      planPages(normal(10), font, bold)[0].rows[0].nameSize,
  );
  for (const n of [1, 3, 6, 10, 11, 16, 20, 40]) {
    const lines = normal(n),
      pages = planPages(lines, font, bold);
    assert.deepEqual(
      pages.flatMap((p) => p.rows.map((r) => r.line.id)),
      lines.map((l) => l.id),
    );
    for (const p of pages)
      assert.ok(
        Math.abs(p.rows.reduce((n, r) => n + r.height, 0) - ROW_SPACE) < 0.001,
      );
  }
});
test("long names get more room and no split rows", async () => {
  const { font, bold } = await fonts();
  const lines = normal(20).map((l, i) => ({
    ...l,
    name:
      i % 3 === 0
        ? "Ekstra langt varenavn med variant og størrelse ".repeat(7)
        : l.name,
  }));
  const pages = planPages(lines, font, bold);
  assert.equal(pages.flatMap((p) => p.rows).length, 20);
  for (const p of pages)
    for (const r of p.rows) {
      assert.ok(r.nameSize >= 18);
      assert.ok(r.quantitySize >= 36);
      assert.ok(r.eanSize >= 16);
      assert.ok(r.height >= 29 * MM + 12);
    }
});
test("EAN symbols have exact module counts", () => {
  assert.equal(eanBits("7025180735989").length, 95);
  assert.equal(eanBits("96385074").length, 67);
});
test("PDF physical page size is A3 and page count matches measured plan", async () => {
  const { bytes, pages } = await makePdf(
    { title: "Test", date: "2026-10-28", location: "", lines: normal(12) },
    crypto.randomUUID(),
    1,
  );
  const d = await PDFDocument.load(bytes);
  assert.equal(pages, 2);
  assert.equal(d.getPageCount(), 2);
  assert.ok(Math.abs(d.getPage(0).getWidth() / MM - 297) < 0.01);
  assert.ok(Math.abs(d.getPage(0).getHeight() / MM - 420) < 0.01);
});

test("large safe quantities widen the quantity field without clipping or tiny text", async () => {
  const { font, bold } = await fonts();
  const lines = normal(3).map((l) => ({
    ...l,
    quantity: Number.MAX_SAFE_INTEGER,
  }));
  const pages = planPages(lines, font, bold);
  for (const p of pages)
    for (const r of p.rows) {
      assert.ok(r.quantitySize >= 36);
      assert.ok(
        bold.widthOfTextAtSize(String(r.line.quantity), r.quantitySize) <=
          p.quantityWidth - 24,
      );
    }
});
