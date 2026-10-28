import { PDFDocument, StandardFonts, PDFFont } from "pdf-lib";
import type { Line } from "./model";
export const MM = 72 / 25.4;
export const PAGE_W = 297 * MM,
  PAGE_H = 420 * MM,
  MARGIN = 10 * MM;
export const CONTENT_TOP = PAGE_H - MARGIN - 86,
  CONTENT_BOTTOM = MARGIN + 26;
export const ROW_SPACE = CONTENT_TOP - CONTENT_BOTTOM;
export const BARCODE_COLUMN_WIDTH = 43 * MM;
export const MIN_ROW_HEIGHT = 29 * MM + 8;
export type RowLayout = {
  line: Line;
  nameLines: string[];
  height: number;
  nameSize: number;
  eanSize: number;
  quantitySize: number;
  nameLineHeight: number;
  textHeight: number;
  nameAscent: number;
  nameDescent: number;
  eanAscent: number;
  stacked: boolean;
  imageSize: number;
  imageGap: number;
};
export type PageLayout = {
  rows: RowLayout[];
  nameWidth: number;
  quantityWidth: number;
  barcodeWidth: number;
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
  prominentEan = false,
  rowBudget = ROW_SPACE,
): RowLayout {
  const stacked = prominentEan;
  const imageGap = line.product?.imageUrl ? (stacked ? 12 : 6) : 0;
  let imageSize = line.product?.imageUrl
    ? Math.min(
        32 * MM,
        Math.max(16 * MM, size * 1.3),
        nameWidth - 12 - imageGap - bold.widthOfTextAtSize(line.ean, 18) - 2,
      )
    : 0;
  const textWidth = nameWidth - 12 - (stacked ? 0 : imageSize + imageGap);
  const nameLines = wrap(line.name, bold, size, textWidth);
  let eanSize = prominentEan ? 34 : Math.max(18, Math.min(34, size * 0.8));
  while (eanSize > 18 && bold.widthOfTextAtSize(line.ean, eanSize) > textWidth)
    eanSize = Math.max(18, eanSize - 1);
  let quantitySize = Math.max(
    36,
    Math.min(prominentEan ? 80 : 96, size * (prominentEan ? 1.6 : 2.3)),
  );
  while (
    bold.widthOfTextAtSize(String(line.quantity), quantitySize) >
      quantityWidth - 12 + 0.001 &&
    quantitySize > 36
  )
    quantitySize = Math.max(36, quantitySize - 1);
  const nameLineHeight = size * 1.12;
  const nameAscent = bold.heightAtSize(size, { descender: false });
  const nameDescent = bold.heightAtSize(size) - nameAscent;
  const eanAscent = bold.heightAtSize(eanSize, { descender: false });
  const textHeight =
    bold.heightAtSize(size) +
    (nameLines.length - 1) * nameLineHeight +
    5 +
    bold.heightAtSize(eanSize);
  if (stacked && imageSize)
    imageSize = Math.max(
      0,
      Math.min(
        90 * MM,
        rowBudget * 0.5,
        rowBudget - textHeight - imageGap - 36,
      ),
    );
  const height = Math.max(
    textHeight + 12 + (stacked ? imageSize + imageGap : 0),
    quantitySize * 1.15 + 12,
    MIN_ROW_HEIGHT,
    imageSize + 12,
  );
  return {
    line,
    nameLines,
    height,
    nameSize: size,
    eanSize,
    quantitySize,
    nameLineHeight,
    textHeight,
    nameAscent,
    nameDescent,
    eanAscent,
    stacked,
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
  const profile = Math.min(
    72,
    Math.round(100 / Math.sqrt(Math.min(lines.length, 10))),
  );
  const desiredQuantitySize = Math.max(
    36,
    Math.min(lines.length <= 3 ? 80 : 96, profile * 2.3),
  );
  const quantityWidth = Math.max(
    28 * MM,
    ...lines.map((l) =>
      Math.min(
        72 * MM,
        bold.widthOfTextAtSize(String(l.quantity), desiredQuantitySize) + 12,
      ),
    ),
    ...lines.map((l) => bold.widthOfTextAtSize(String(l.quantity), 36) + 12),
  );
  const nameWidth = PAGE_W - 2 * MARGIN - BARCODE_COLUMN_WIDTH - quantityWidth;
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
    if (group.length <= 3) {
      // Fit each name independently: a long name must not shrink the other products.
      rows = group.map((line) => {
        const lineLimit = Math.min(
          4,
          Math.max(2, Math.ceil(line.name.length / 36)),
        );
        let fallback = measure(
          line,
          font,
          bold,
          18,
          nameWidth,
          quantityWidth,
          true,
          ROW_SPACE / group.length,
        );
        for (let size = 48; size >= 18; size--) {
          const candidate = measure(
            line,
            font,
            bold,
            size,
            nameWidth,
            quantityWidth,
            true,
            ROW_SPACE / group.length,
          );
          const textWidth =
            nameWidth -
            12 -
            (candidate.stacked ? 0 : candidate.imageSize + candidate.imageGap);
          const wholeWords = printable(line.name, bold)
            .split(/\s+/)
            .every((word) => bold.widthOfTextAtSize(word, size) <= textWidth);
          if (candidate.height > ROW_SPACE / group.length) continue;
          if (wholeWords) fallback = candidate;
          if (wholeWords && candidate.nameLines.length <= lineLimit)
            return candidate;
        }
        return fallback;
      });
    } else {
      for (
        let size = Math.min(72, Math.round(100 / Math.sqrt(group.length)));
        size >= 18;
        size--
      ) {
        const candidate = group.map((line) =>
          measure(line, font, bold, size, nameWidth, quantityWidth),
        );
        if (candidate.reduce((sum, row) => sum + row.height, 0) <= ROW_SPACE) {
          rows = candidate;
          break;
        }
      }
    }
    const spare = ROW_SPACE - rows.reduce((n, r) => n + r.height, 0);
    return {
      nameWidth,
      quantityWidth,
      barcodeWidth: BARCODE_COLUMN_WIDTH,
      rows: rows.map((r) => ({ ...r, height: r.height + spare / rows.length })),
    };
  });
}
