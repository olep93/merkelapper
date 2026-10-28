import { PDFDocument, StandardFonts, PDFFont } from "pdf-lib";
import type { Line } from "./model";
export const MM = 72 / 25.4;
export const PAGE_W = 297 * MM,
  PAGE_H = 420 * MM,
  MARGIN = 10 * MM;
export const CONTENT_TOP = PAGE_H - MARGIN - 86,
  CONTENT_BOTTOM = MARGIN + 26;
export const ROW_SPACE = CONTENT_TOP - CONTENT_BOTTOM;
export const NAME_WIDTH = 151 * MM;
export type RowLayout = {
  line: Line;
  nameLines: string[];
  height: number;
  nameSize: number;
  eanSize: number;
  quantitySize: number;
  imageSize: number;
  imageGap: number;
};
export type PageLayout = {
  rows: RowLayout[];
  nameWidth: number;
  quantityWidth: number;
};
export function printable(text: string, font: PDFFont) {
  return [
    ...text
      .normalize("NFC")
      .replace(/[\r\n\t]+/g, " ")
      .replace(/[–—−]/g, "-"),
  ]
    .map((c) => {
      try {
        font.encodeText(c);
        return c;
      } catch {
        return "?";
      }
    })
    .join("");
}
export function wrap(
  text: string,
  font: PDFFont,
  size: number,
  width: number,
): string[] {
  const words = printable(text, font).split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    if (font.widthOfTextAtSize(word, size) > width) {
      if (line) {
        lines.push(line);
        line = "";
      }
      let part = "";
      for (const ch of word) {
        if (part && font.widthOfTextAtSize(part + ch, size) > width) {
          lines.push(part);
          part = "";
        }
        part += ch;
      }
      line = part;
    } else if (
      line &&
      font.widthOfTextAtSize(line + " " + word, size) > width
    ) {
      lines.push(line);
      line = word;
    } else line = line ? line + " " + word : word;
  }
  if (line) lines.push(line);
  return lines.length ? lines : [""];
}
function measure(
  line: Line,
  font: PDFFont,
  bold: PDFFont,
  size: number,
  nameWidth: number,
  quantityWidth: number,
): RowLayout {
  const imageGap = line.product?.imageUrl ? 10 : 0;
  const imageSize = line.product?.imageUrl
    ? Math.min(
        52 * MM,
        Math.max(20 * MM, size * 2.2),
        nameWidth - 24 - imageGap - font.widthOfTextAtSize(line.ean, 16) - 2,
      )
    : 0;
  const textWidth = nameWidth - 24 - imageSize - imageGap;
  const nameLines = wrap(line.name, bold, size, textWidth);
  let eanSize = Math.max(16, Math.min(32, size * 0.8));
  while (eanSize > 16 && font.widthOfTextAtSize(line.ean, eanSize) > textWidth)
    eanSize = Math.max(16, eanSize - 1);
  let quantitySize = Math.max(36, Math.min(110, size * 2.3));
  while (
    bold.widthOfTextAtSize(String(line.quantity), quantitySize) >
      quantityWidth - 24 + 0.001 &&
    quantitySize > 36
  )
    quantitySize = Math.max(36, quantitySize - 1);
  const height = Math.max(
    nameLines.length * size * 1.17 + eanSize * 1.3 + 20,
    quantitySize * 1.15 + 20,
    29 * MM + 12,
    imageSize + 16,
  );
  return {
    line,
    nameLines,
    height,
    nameSize: size,
    eanSize,
    quantitySize,
    imageSize,
    imageGap,
  };
}
export async function fonts() {
  const doc = await PDFDocument.create();
  return {
    doc,
    font: await doc.embedFont(StandardFonts.Helvetica),
    bold: await doc.embedFont(StandardFonts.HelveticaBold),
  };
}
export function planPages(
  lines: Line[],
  font: PDFFont,
  bold: PDFFont,
): PageLayout[] {
  if (!lines.length) return [];
  const quantityWidth = Math.max(
    72 * MM,
    ...lines.map((l) => bold.widthOfTextAtSize(String(l.quantity), 36) + 24),
  );
  const nameWidth = PAGE_W - 2 * MARGIN - 54 * MM - quantityWidth;
  const minimum = lines.map((l) =>
    measure(l, font, bold, 18, nameWidth, quantityWidth),
  );
  if (minimum.some((r) => r.height > ROW_SPACE))
    throw new Error(
      "Et varenavn er for langt for én A3-side. Forkort navnet før utskrift.",
    );
  const prefix = [0];
  for (const r of minimum) prefix.push(prefix.at(-1)! + r.height);
  let pages = 1,
    used = 0;
  for (const r of minimum) {
    if (used + r.height > ROW_SPACE) {
      pages++;
      used = 0;
    }
    used += r.height;
  }
  // At the minimum page count, find ordered page breaks with balanced occupied height and row count.
  const target = prefix.at(-1)! / pages,
    countTarget = lines.length / pages;
  const costs = Array.from({ length: pages + 1 }, () =>
    Array(lines.length + 1).fill(Infinity),
  );
  const cuts = Array.from({ length: pages + 1 }, () =>
    Array(lines.length + 1).fill(-1),
  );
  costs[0][0] = 0;
  for (let p = 1; p <= pages; p++)
    for (let end = p; end <= lines.length; end++)
      for (let start = end - 1; start >= p - 1; start--) {
        const height = prefix[end] - prefix[start];
        if (height > ROW_SPACE) break;
        const score =
          costs[p - 1][start] +
          (height - target) ** 2 +
          ((end - start - countTarget) * 50) ** 2;
        if (score < costs[p][end]) {
          costs[p][end] = score;
          cuts[p][end] = start;
        }
      }
  const groups: Line[][] = [];
  let end = lines.length;
  for (let p = pages; p > 0; p--) {
    const start = cuts[p][end];
    if (start < 0) throw new Error("Kunne ikke fordele varer.");
    groups.unshift(lines.slice(start, end));
    end = start;
  }
  return groups.map((group) => {
    let rows = group.map((l) =>
      measure(l, font, bold, 18, nameWidth, quantityWidth),
    );
    for (
      let size = Math.min(72, Math.round(100 / Math.sqrt(group.length)));
      size >= 18;
      size--
    ) {
      const candidate = group.map((l) =>
        measure(l, font, bold, size, nameWidth, quantityWidth),
      );
      if (candidate.reduce((n, r) => n + r.height, 0) <= ROW_SPACE) {
        rows = candidate;
        break;
      }
    }
    const spare = ROW_SPACE - rows.reduce((n, r) => n + r.height, 0);
    return {
      nameWidth,
      quantityWidth,
      rows: rows.map((r) => ({ ...r, height: r.height + spare / rows.length })),
    };
  });
}
