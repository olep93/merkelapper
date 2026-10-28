import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";
import { readBarcodes, prepareZXingModule } from "zxing-wasm/reader";
prepareZXingModule({
  overrides: { wasmBinary: await readFile("public/zxing_reader.wasm") },
});
const results = await readBarcodes(
  await readFile("tmp/pdfs/10-varer-200dpi.png"),
  { formats: ["EAN-13", "EAN-8"], tryHarder: true, maxNumberOfSymbols: 255 },
);
const expected = [
  "7025180735989",
  "3253560306977",
  "7029350011217",
  "7025180674691",
  "7025180690158",
  "3253560306571",
  "3253560306878",
  "7314150119080",
  "7314150119233",
  "7025180586857",
];
assert.deepEqual(
  results
    .sort((a, b) => a.position.topLeft.y - b.position.topLeft.y)
    .map((r) => r.text),
  expected,
);
console.log(
  "PASS: all ten vector EANs decode from a 200dpi PDF rendering in their correct row order",
);
