import { rgb } from "pdf-lib";
import {
  fonts,
  planPages,
  printable,
  MM,
  PAGE_W,
  PAGE_H,
  MARGIN,
  CONTENT_TOP,
} from "./layout";
import { dateLabel, type SheetBody } from "./model";
// EAN encoding tables. Bars are drawn directly as vectors at X=0.33mm.
const L = [
  "0001101",
  "0011001",
  "0010011",
  "0111101",
  "0100011",
  "0110001",
  "0101111",
  "0111011",
  "0110111",
  "0001011",
];
const G = [
  "0100111",
  "0110011",
  "0011011",
  "0100001",
  "0011101",
  "0111001",
  "0000101",
  "0010001",
  "0001001",
  "0010111",
];
const parity = [
  "LLLLLL",
  "LLGLGG",
  "LLGGLG",
  "LLGGGL",
  "LGLLGG",
  "LGGLLG",
  "LGGGLL",
  "LGLGLG",
  "LGLGGL",
  "LGGLGL",
];
export function eanBits(ean: string) {
  const R = (d: string) =>
    L[Number(d)].replace(/[01]/g, (c) => (c === "0" ? "1" : "0"));
  if (ean.length === 8)
    return (
      "101" +
      [...ean.slice(0, 4)].map((d) => L[+d]).join("") +
      "01010" +
      [...ean.slice(4)].map(R).join("") +
      "101"
    );
  return (
    "101" +
    [...ean.slice(1, 7)]
      .map((d, i) => (parity[+ean[0]][i] === "L" ? L : G)[+d])
      .join("") +
    "01010" +
    [...ean.slice(7)].map(R).join("") +
    "101"
  );
}
export async function makePdf(body: SheetBody, id: string, revision: number) {
  const { doc, font, bold } = await fonts();
  const pages = planPages(body.lines, font, bold);
  doc.setTitle(`Merkelapp ${id.slice(0, 8)} - revisjon ${revision}`);
  doc.setCreator("Jobbverktøy - Merkelapp");
  for (const [pi, layout] of pages.entries()) {
    const page = doc.addPage([PAGE_W, PAGE_H]);
    const black = rgb(0, 0, 0),
      gray = rgb(0.35, 0.35, 0.35),
      lineColor = rgb(0.7, 0.7, 0.7);
    page.drawText("VARETELLING", {
      x: MARGIN,
      y: PAGE_H - MARGIN - 28,
      size: 28,
      font: bold,
      color: black,
    });
    const date = dateLabel(body.date);
    page.drawText(date, {
      x: PAGE_W - MARGIN - bold.widthOfTextAtSize(date, 26),
      y: PAGE_H - MARGIN - 28,
      size: 26,
      font: bold,
    });
    if (body.location)
      page.drawText(printable(body.location, font), {
        x: MARGIN,
        y: PAGE_H - MARGIN - 49,
        size: 12,
        font,
        maxWidth: PAGE_W - 2 * MARGIN,
      });
    const tableWidth = PAGE_W - 2 * MARGIN,
      qtyX = MARGIN + layout.nameWidth,
      barcodeX = qtyX + layout.quantityWidth;
    page.drawRectangle({
      x: MARGIN,
      y: CONTENT_TOP,
      width: tableWidth,
      height: 23,
      color: rgb(1, 0.83, 0.25),
    });
    for (const [label, x] of [
      ["VARE / EAN", MARGIN + 10],
      ["ANTALL", qtyX + 10],
      ["SKANN VARE", barcodeX + 8],
    ] as const)
      page.drawText(label, { x, y: CONTENT_TOP + 7, size: 11, font: bold });
    let y = CONTENT_TOP;
    for (const r of layout.rows) {
      const bottom = y - r.height,
        mid = (y + bottom) / 2;
      page.drawLine({
        start: { x: MARGIN, y: bottom },
        end: { x: PAGE_W - MARGIN, y: bottom },
        thickness: 0.7,
        color: lineColor,
      });
      for (const x of [qtyX, barcodeX])
        page.drawLine({
          start: { x, y },
          end: { x, y: bottom },
          thickness: 0.5,
          color: lineColor,
        });
      const textHeight =
        r.nameLines.length * r.nameSize * 1.17 + r.eanSize * 1.3;
      let ty = mid + textHeight / 2 - r.nameSize;
      for (const name of r.nameLines) {
        page.drawText(name, {
          x: MARGIN + 10,
          y: ty,
          size: r.nameSize,
          font: bold,
        });
        ty -= r.nameSize * 1.17;
      }
      page.drawText(r.line.ean, {
        x: MARGIN + 10,
        y: ty - 5,
        size: r.eanSize,
        font,
        color: gray,
      });
      const q = String(r.line.quantity);
      page.drawText(q, {
        x:
          qtyX +
          (layout.quantityWidth - bold.widthOfTextAtSize(q, r.quantitySize)) /
            2,
        y: mid - r.quantitySize * 0.34,
        size: r.quantitySize,
        font: bold,
      });
      const bits = eanBits(r.line.ean),
        xDim = 0.33 * MM,
        quiet = r.line.ean.length === 13 ? 11 : 7;
      const total = (bits.length + quiet + 7) * xDim;
      const fieldWidth = PAGE_W - MARGIN - barcodeX;
      const bx = barcodeX + (fieldWidth - total) / 2 + quiet * xDim,
        by = mid - (27 * MM) / 2 + 9;
      const barHeight = 22.85 * MM;
      for (let i = 0; i < bits.length; i++)
        if (bits[i] === "1") {
          const guard =
            i < 3 ||
            i >= bits.length - 3 ||
            Math.abs(i - bits.length / 2) < 2.5;
          page.drawRectangle({
            x: bx + i * xDim,
            y: by - (guard ? 4 : 0),
            width: xDim,
            height: barHeight + (guard ? 4 : 0),
            color: black,
          });
        }
      page.drawText(r.line.ean, {
        x: barcodeX + (fieldWidth - font.widthOfTextAtSize(r.line.ean, 9)) / 2,
        y: by - 16,
        size: 9,
        font,
      });
      y = bottom;
    }
    page.drawText(
      `Lapp ${id.slice(0, 8).toUpperCase()}  |  Revisjon ${revision}  |  A3 - faktisk størrelse / 100 %`,
      { x: MARGIN, y: MARGIN + 7, size: 9, font, color: gray },
    );
    const p = `Side ${pi + 1} av ${pages.length}`;
    page.drawText(p, {
      x: PAGE_W - MARGIN - font.widthOfTextAtSize(p, 10),
      y: MARGIN + 7,
      size: 10,
      font,
    });
  }
  return { bytes: await doc.save(), pages: pages.length };
}
