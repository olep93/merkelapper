import { makePdf } from "../src/lib/pdf";
import { writeFile, mkdir } from "node:fs/promises";
const products = [
  ["Kellen skruesett utendørs 270 stk", "7025180735989"],
  ["Stanley målebånd 5 m / 0-30-697", "3253560306977"],
  ["Jotun tynner no.7 0,5 liter", "7029350011217"],
  ["Kellen treskruer C4 5 x 70 mm, 800 pk", "7025180674691"],
  ["Kellen WAF C4 10 x 100 mm, 25 pk", "7025180690158"],
  ["Stanley målebånd 8 m / 0-30-657", "3253560306571"],
  ["Stanley målebånd 3 m / 0-33-720", "3253560306878"],
  ["Bahco MTB-5-25 målebånd", "7314150119080"],
  ["Bahco MTS-5-25 målebånd", "7314150119233"],
  ["Kellen målebånd 5 m", "7025180586857"],
];
async function main() {
  await mkdir("tmp/pdfs", { recursive: true });
  for (const n of [1, 3, 10, 12, 40]) {
    const lines = Array.from({ length: n }, (_, i) => ({
      id: crypto.randomUUID(),
      name: products[i % 10][0],
      ean: products[i % 10][1],
      quantity: (i + 1) * 12,
    }));
    const { bytes } = await makePdf(
      { title: "Test", date: "2026-10-28", location: "", lines },
      "12345678-0000-4000-8000-000000000000",
      1,
    );
    await writeFile(`tmp/pdfs/${n}-varer.pdf`, bytes);
  }
}
main();
