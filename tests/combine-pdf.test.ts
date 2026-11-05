import { test } from "node:test";
import assert from "node:assert/strict";
import { PDFDocument, PrintScaling } from "pdf-lib";
import { combinePdfs } from "../src/lib/combine-pdf";
const pdf = async (pages: number) => {
  const doc = await PDFDocument.create();
  for (let i = 0; i < pages; i++) doc.addPage([842, 1191]);
  return doc.save();
};
test("combined sheets keep their page order and the A3 print request", async () => {
  const { bytes, pages } = await combinePdfs(
    [await pdf(2), await pdf(1), await pdf(3)],
    "Merkelapp samlet",
  );
  const doc = await PDFDocument.load(bytes);
  assert.equal(pages, 6);
  assert.equal(doc.getPageCount(), 6);
  assert.deepEqual(doc.getPage(5).getSize(), { width: 842, height: 1191 });
  const prefs = doc.catalog.getViewerPreferences()!;
  assert.equal(prefs.getPrintScaling(), PrintScaling.None);
  assert.equal(prefs.getPickTrayByPDFSize(), true);
});
