import {
  PrintScaling,
  rgb,
  type PDFFont,
  type PDFImage,
  type PDFPage,
} from "pdf-lib";
import { loadPrintImages, type PrintImageLoader } from "./print-images";
import {
  fonts,
  planPages,
  planAreaPages,
  printable,
  MM,
  PAGE_W,
  PAGE_H,
  MARGIN,
  CONTENT_TOP,
  AREA_CONTENT_TOP,
} from "./layout";
import { dateLabel, type SheetBody } from "./model";
import { eanBits } from "./barcode";
export { eanBits } from "./barcode";
function drawBars(
  page: PDFPage,
  bits: string,
  x: number,
  y: number,
  height: number,
  guardDrop: number,
) {
  const xDim = 0.33 * MM;
  for (let i = 0; i < bits.length; i++)
    if (bits[i] === "1") {
      const guard =
        i < 3 || i >= bits.length - 3 || Math.abs(i - bits.length / 2) < 2.5;
      page.drawRectangle({
        x: x + i * xDim,
        y: y - (guard ? guardDrop : 0),
        width: xDim,
        height: height + (guard ? guardDrop : 0),
        color: rgb(0, 0, 0),
      });
    }
}
function shortened(text: string, font: PDFFont, size: number, width: number) {
  let result = printable(text, font);
  if (font.widthOfTextAtSize(result, size) <= width) return result;
  while (result && font.widthOfTextAtSize(result + "…", size) > width)
    result = result.slice(0, -1);
  return result.trimEnd() + "…";
}
function drawCentered(
  page: PDFPage,
  text: string,
  x: number,
  width: number,
  y: number,
  size: number,
  font: PDFFont,
  color = rgb(0, 0, 0),
) {
  page.drawText(text, {
    x: x + (width - font.widthOfTextAtSize(text, size)) / 2,
    y,
    size,
    font,
    color,
  });
}
async function makeAreaPdf(
  body: SheetBody,
  id: string,
  revision: number,
  creatorName?: string,
) {
  const { doc, font, bold } = await fonts();
  const pages = planAreaPages(body.lines, font, bold, body.sources);
  doc.setTitle(`Merkelapp ${id.slice(0, 8)} - revisjon ${revision}`);
  doc.setCreator("Jobbverktøy - Merkelapp");
  const viewerPrefs = doc.catalog.getOrCreateViewerPreferences();
  viewerPrefs.setPickTrayByPDFSize(true);
  viewerPrefs.setPrintScaling(PrintScaling.None);
  const eanColor = rgb(0.043, 0.239, 0.569),
    lineColor = rgb(0.7, 0.7, 0.7),
    tableWidth = PAGE_W - 2 * MARGIN;
  for (const [pi, layout] of pages.entries()) {
    const page = doc.addPage([PAGE_W, PAGE_H]);
    const top = PAGE_H - MARGIN;
    page.drawText("VARETELLING", { x: MARGIN, y: top - 28, size: 28, font: bold });
    const date = dateLabel(body.date);
    page.drawText(date, {
      x: PAGE_W - MARGIN - bold.widthOfTextAtSize(date, 26),
      y: top - 28,
      size: 26,
      font: bold,
    });
    const author = creatorName ? printable(`Laget av ${creatorName}`, bold) : "";
    const authorWidth = author ? bold.widthOfTextAtSize(author, 14) : 0;
    if (author)
      page.drawText(author, {
        x: PAGE_W - MARGIN - authorWidth,
        y: top - 49,
        size: 14,
        font: bold,
      });
    const heading = [body.title, body.location].filter(Boolean).join(" · ");
    if (heading)
      page.drawText(
        shortened(heading, bold, 14, tableWidth - authorWidth - 20),
        { x: MARGIN, y: top - 49, size: 14, font: bold },
      );
    if (body.sources?.length)
      page.drawText(
        shortened(
          `Sammenslått av: ${body.sources.map((s) => s.title).join(", ")}`,
          font,
          10,
          tableWidth,
        ),
        { x: MARGIN, y: top - 66, size: 10, font },
      );
    const side = layout.quantityWidth + layout.barcodeWidth,
      nameX = MARGIN + side;
    page.drawRectangle({
      x: MARGIN,
      y: AREA_CONTENT_TOP,
      width: tableWidth,
      height: 23,
      color: rgb(1, 0.83, 0.25),
    });
    for (const [label, x, width] of [
      ["ANTALL / STREKKODE", MARGIN, side],
      ["VARE / EAN", nameX, layout.nameWidth],
      ["ANTALL / STREKKODE", nameX + layout.nameWidth, side],
    ] as const)
      drawCentered(page, label, x, width, AREA_CONTENT_TOP + 7, 11, bold);
    let y = AREA_CONTENT_TOP;
    for (const r of layout.rows) {
      const bottom = y - layout.rowHeight;
      page.drawLine({
        start: { x: MARGIN, y: bottom },
        end: { x: PAGE_W - MARGIN, y: bottom },
        thickness: 0.5,
        color: lineColor,
      });
      for (const x of [nameX, nameX + layout.nameWidth])
        page.drawLine({
          start: { x, y },
          end: { x, y: bottom },
          thickness: 0.35,
          color: lineColor,
        });
      const lineHeight = r.nameSize * 1.14,
        textHeight = r.nameLines.length * lineHeight + layout.eanSize + 2;
      let ty = y - (layout.rowHeight - textHeight) / 2 - r.nameSize * 0.85;
      for (const name of r.nameLines) {
        drawCentered(page, name, nameX + 6, layout.nameWidth - 12, ty, r.nameSize, bold);
        ty -= lineHeight;
      }
      drawCentered(
        page,
        r.line.ean,
        nameX + 6,
        layout.nameWidth - 12,
        ty + lineHeight - r.nameSize * 0.25 - 2 - layout.eanSize * 0.8,
        layout.eanSize,
        font,
        eanColor,
      );
      // The quantity sits next to the name; the barcode takes the outer edge.
      const barcodeX =
          r.side === "right"
            ? PAGE_W - MARGIN - layout.barcodeWidth
            : MARGIN,
        qtyX =
          r.side === "right"
            ? barcodeX - layout.quantityWidth
            : MARGIN + layout.barcodeWidth;
      const rule = r.side === "right" ? barcodeX : qtyX;
      page.drawLine({
        start: { x: rule, y },
        end: { x: rule, y: bottom },
        thickness: 0.35,
        color: lineColor,
      });
      const calcGap = r.calcLines.length ? 3 : 0,
        calcHeight = r.calcLines.length * (layout.calcSize + 1) + calcGap;
      let cy = y - (layout.rowHeight - calcHeight - r.quantitySize * 0.72) / 2;
      for (const calc of r.calcLines) {
        cy -= layout.calcSize + 1;
        drawCentered(page, calc, qtyX, layout.quantityWidth, cy + 1.5, layout.calcSize, font);
      }
      drawCentered(
        page,
        String(r.line.quantity),
        qtyX,
        layout.quantityWidth,
        cy - calcGap - r.quantitySize * 0.72,
        r.quantitySize,
        bold,
      );
      const freeX = r.side === "right" ? MARGIN : nameX + layout.nameWidth,
        lineStep = r.breakdownSize * 1.2;
      let by =
        y -
        (layout.rowHeight - r.breakdown.length * lineStep) / 2 -
        r.breakdownSize * 0.95;
      for (const part of r.breakdown) {
        page.drawText(part.label, {
          x: freeX + 8,
          y: by,
          size: r.breakdownSize,
          font,
          color: rgb(0.25, 0.25, 0.25),
        });
        page.drawText(part.quantity, {
          x:
            freeX +
            side -
            8 -
            bold.widthOfTextAtSize(part.quantity, r.breakdownSize),
          y: by,
          size: r.breakdownSize,
          font: bold,
          color: rgb(0.25, 0.25, 0.25),
        });
        by -= lineStep;
      }
      const bits = eanBits(r.line.ean),
        quiet = r.line.ean.length === 13 ? 11 : 7,
        xDim = 0.33 * MM,
        total = (bits.length + quiet + 7) * xDim;
      drawBars(
        page,
        bits,
        barcodeX + (layout.barcodeWidth - total) / 2 + quiet * xDim,
        bottom + 9,
        layout.rowHeight - 12.8,
        2,
      );
      drawCentered(page, r.line.ean, barcodeX, layout.barcodeWidth, bottom + 1.2, 7, font);
      y = bottom;
    }
    const label = `Side ${pi + 1} av ${pages.length}`;
    page.drawText(label, {
      x: PAGE_W - MARGIN - font.widthOfTextAtSize(label, 10),
      y: MARGIN + 7,
      size: 10,
      font,
    });
  }
  return {
    bytes: await doc.save(),
    pages: pages.length,
    missingImages: 0,
    maskedImages: 0,
  };
}
export async function makePdf(
  body: SheetBody,
  id: string,
  revision: number,
  options: { imageLoader?: PrintImageLoader; creatorName?: string } = {},
) {
  if (body.kind) return makeAreaPdf(body, id, revision, options.creatorName);
  const { doc, font, bold } = await fonts();
  const pages = planPages(body.lines, font, bold);
  const prepared = await (options.imageLoader || loadPrintImages)(body.lines);
  const embedded = new Map<string, PDFImage>();
  let missingImages = 0,
    maskedImages = 0;
  for (const line of body.lines) {
    const url = line.product?.imageUrl;
    if (!url) continue;
    const image = prepared.get(url);
    if (!image) {
      missingImages++;
      continue;
    }
    if (!embedded.has(url)) embedded.set(url, await doc.embedJpg(image.bytes));
    if (image.masks.length) maskedImages++;
  }
  doc.setTitle(`Merkelapp ${id.slice(0, 8)} - revisjon ${revision}`);
  doc.setCreator("Jobbverktøy - Merkelapp");
  // Ask the print dialog for paper matching the A3 page at 100 %. Honoured per PDF reader and printer.
  const viewerPrefs = doc.catalog.getOrCreateViewerPreferences();
  viewerPrefs.setPickTrayByPDFSize(true);
  viewerPrefs.setPrintScaling(PrintScaling.None);
  for (const [pi, layout] of pages.entries()) {
    const page = doc.addPage([PAGE_W, PAGE_H]);
    const black = rgb(0, 0, 0),
      gray = rgb(0.35, 0.35, 0.35),
      eanColor = rgb(0.043, 0.239, 0.569),
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
    const author = options.creatorName
      ? printable(`Laget av ${options.creatorName}`, bold)
      : "";
    const authorWidth = bold.widthOfTextAtSize(author, 14);
    if (author)
      page.drawText(author, {
        x: PAGE_W - MARGIN - authorWidth,
        y: PAGE_H - MARGIN - 49,
        size: 14,
        font: bold,
      });
    if (body.location)
      page.drawText(printable(body.location, font), {
        x: MARGIN,
        y: PAGE_H - MARGIN - 49,
        size: 12,
        font,
        maxWidth: PAGE_W - 2 * MARGIN - (author ? authorWidth + 20 : 0),
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
    const headerSize = 14;
    for (const [label, x, width] of [
      ["VARE / EAN", MARGIN, layout.nameWidth],
      ["ANTALL", qtyX, layout.quantityWidth],
      ["SKANN VARE", barcodeX, layout.barcodeWidth],
    ] as const)
      page.drawText(label, {
        x: x + (width - bold.widthOfTextAtSize(label, headerSize)) / 2,
        y: CONTENT_TOP + 6,
        size: headerSize,
        font: bold,
      });
    let y = CONTENT_TOP;
    for (const r of layout.rows) {
      const bottom = y - r.height,
        mid = (y + bottom) / 2;
      page.drawLine({
        start: { x: MARGIN, y: bottom },
        end: { x: PAGE_W - MARGIN, y: bottom },
        thickness: 0.5,
        color: lineColor,
      });
      for (const x of [qtyX, barcodeX])
        page.drawLine({
          start: { x, y },
          end: { x, y: bottom },
          thickness: 0.35,
          color: lineColor,
        });
      const blockHeight =
        r.textHeight +
        (r.stacked && r.imageSize ? r.imageSize + r.imageGap : 0);
      const blockTop = mid + blockHeight / 2;
      const imageMid = r.stacked ? blockTop - r.imageSize / 2 : mid;
      const imageUrl = r.line.product?.imageUrl;
      const preparedImage = imageUrl ? prepared.get(imageUrl) : undefined;
      if (r.imageSize && imageUrl) {
        const image = embedded.get(imageUrl),
          boxX = r.stacked
            ? MARGIN + (layout.nameWidth - r.imageSize) / 2
            : MARGIN + 6,
          boxY = imageMid - r.imageSize / 2;
        if (image && preparedImage) {
          const scale = Math.min(
            r.imageSize / preparedImage.width,
            r.imageSize / preparedImage.height,
          );
          const width = preparedImage.width * scale,
            height = preparedImage.height * scale;
          const ix = boxX + (r.imageSize - width) / 2,
            iy = imageMid - height / 2;
          page.drawImage(image, { x: ix, y: iy, width, height });
          for (const mask of preparedImage.masks)
            page.drawRectangle({
              x: ix + mask.x * scale,
              y: iy + height - (mask.y + mask.height) * scale,
              width: mask.width * scale,
              height: mask.height * scale,
              color: rgb(1, 1, 1),
            });
        } else {
          page.drawRectangle({
            x: boxX,
            y: boxY,
            width: r.imageSize,
            height: r.imageSize,
            borderWidth: 0.5,
            borderColor: rgb(0.88, 0.88, 0.88),
          });
          const label = "Bilde mangler";
          page.drawText(label, {
            x: boxX + (r.imageSize - font.widthOfTextAtSize(label, 7)) / 2,
            y: imageMid - 2,
            size: 7,
            font,
            color: gray,
          });
        }
      }
      const textX = MARGIN + 6 + (r.stacked ? 0 : r.imageSize + r.imageGap);
      const textWidth =
        layout.nameWidth - 12 - (r.stacked ? 0 : r.imageSize + r.imageGap);
      let ty =
        (r.stacked
          ? blockTop - (r.imageSize ? r.imageSize + r.imageGap : 0)
          : mid + r.textHeight / 2) - r.nameAscent;
      for (const name of r.nameLines) {
        page.drawText(name, {
          x:
            textX +
            (r.stacked
              ? (textWidth - bold.widthOfTextAtSize(name, r.nameSize)) / 2
              : 0),
          y: ty,
          size: r.nameSize,
          font: bold,
        });
        ty -= r.nameLineHeight;
      }
      page.drawText(r.line.ean, {
        x:
          textX +
          (textWidth - font.widthOfTextAtSize(r.line.ean, r.eanSize)) / 2,
        y: ty + r.nameLineHeight - r.nameDescent - 5 - r.eanAscent,
        size: r.eanSize,
        font,
        color: eanColor,
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
      const barHeight = 22.85 * MM;
      const bx = barcodeX + (fieldWidth - total) / 2 + quiet * xDim,
        by = mid - (barHeight - 18) / 2;
      drawBars(page, bits, bx, by, barHeight, 4);
      page.drawText(r.line.ean, {
        x: barcodeX + (fieldWidth - font.widthOfTextAtSize(r.line.ean, 9)) / 2,
        y: by - 16,
        size: 9,
        font,
      });
      y = bottom;
    }
    const p = `Side ${pi + 1} av ${pages.length}`;
    page.drawText(p, {
      x: PAGE_W - MARGIN - font.widthOfTextAtSize(p, 10),
      y: MARGIN + 7,
      size: 10,
      font,
    });
  }
  return {
    bytes: await doc.save(),
    pages: pages.length,
    missingImages,
    maskedImages,
  };
}
