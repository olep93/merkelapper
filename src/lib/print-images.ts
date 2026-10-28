import { readFile } from "node:fs/promises";
import { join } from "node:path";
import sharp from "sharp";
import { prepareZXingModule, readBarcodes } from "zxing-wasm/reader";
import { obsUrl } from "./products";
import type { Line } from "./model";
export type ImageMask = { x: number; y: number; width: number; height: number };
export type PrintImage = {
  bytes: Uint8Array;
  width: number;
  height: number;
  masks: ImageMask[];
};
let decoder: Promise<unknown> | undefined;
async function decoderReady() {
  if (!decoder)
    decoder = readFile(join(process.cwd(), "public/zxing_reader.wasm"))
      .then((wasmBinary) =>
        prepareZXingModule({
          overrides: { wasmBinary },
          fireImmediately: true,
        }),
      )
      .catch((e) => {
        decoder = undefined;
        throw e;
      });
  await decoder;
}
/** Decode the same pixels that will be embedded, then cover every readable code with PDF vector rectangles. */
export async function preparePrintImage(
  input: Uint8Array,
): Promise<PrintImage> {
  const { data, info } = await sharp(input, { limitInputPixels: 25_000_000 })
    .rotate()
    .resize({
      width: 800,
      height: 800,
      fit: "inside",
      withoutEnlargement: true,
    })
    .flatten({ background: "#ffffff" })
    .jpeg({ quality: 85 })
    .toBuffer({ resolveWithObject: true });
  await decoderReady();
  const codes = await readBarcodes(data, {
    tryHarder: true,
    tryRotate: true,
    tryInvert: true,
    maxNumberOfSymbols: 255,
  });
  const masks: ImageMask[] = codes
    .filter((c) => c.isValid)
    .map((c) => {
      const points = Object.values(c.position),
        pad = Math.max(20, Math.ceil(Math.max(info.width, info.height) * 0.04));
      const x = Math.max(0, Math.min(...points.map((p) => p.x)) - pad),
        y = Math.max(0, Math.min(...points.map((p) => p.y)) - pad);
      const right = Math.min(
          info.width,
          Math.max(...points.map((p) => p.x)) + pad,
        ),
        bottom = Math.min(
          info.height,
          Math.max(...points.map((p) => p.y)) + pad,
        );
      return { x, y, width: right - x, height: bottom - y };
    });
  return { bytes: data, width: info.width, height: info.height, masks };
}
async function boundedBytes(response: Response) {
  const limit = 6 * 1024 * 1024;
  if (Number(response.headers.get("content-length")) > limit)
    throw new Error("Image too large");
  if (!response.body) throw new Error("Empty image");
  const reader = response.body.getReader(),
    parts: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > limit) throw new Error("Image too large");
      parts.push(value);
    }
  } finally {
    await reader.cancel().catch(() => {});
  }
  const data = new Uint8Array(size);
  let offset = 0;
  for (const part of parts) {
    data.set(part, offset);
    offset += part.byteLength;
  }
  return data;
}
const images = new Map<string, { image: PrintImage; expires: number }>();
const pending = new Map<string, Promise<PrintImage | undefined>>();
async function loadImage(
  url: string,
  signal: AbortSignal,
): Promise<PrintImage | undefined> {
  const allowed = obsUrl(url, true);
  if (!allowed || signal.aborted) return;
  const cached = images.get(allowed);
  if (cached && cached.expires > Date.now()) return cached.image;
  const existing = pending.get(allowed);
  if (existing) return existing;
  const promise = (async () => {
    try {
      const response = await fetch(allowed, {
        signal,
        redirect: "error",
        cache: "no-store",
        headers: {
          Accept: "image/jpeg,image/png,image/webp",
          "User-Agent": "MerkelappTest/0.3 (+https://jobbverktoy.no/merkelapp)",
        },
      });
      if (
        !response.ok ||
        !response.headers.get("content-type")?.startsWith("image/")
      )
        return;
      const bytes = await boundedBytes(response);
      if (signal.aborted) return;
      const image = await preparePrintImage(bytes);
      if (images.size >= 100) images.delete(images.keys().next().value!);
      images.set(allowed, { image, expires: Date.now() + 4 * 60 * 60_000 });
      return image;
    } catch {
      return;
    }
  })().finally(() => pending.delete(allowed));
  pending.set(allowed, promise);
  return promise;
}
export type PrintImageLoader = (
  lines: Line[],
) => Promise<Map<string, PrintImage>>;
export const loadPrintImages: PrintImageLoader = async (lines) => {
  const urls = [
      ...new Set(
        lines
          .map((l) => l.product?.imageUrl)
          .filter((url): url is string => !!url),
      ),
    ],
    result = new Map<string, PrintImage>();
  if (!urls.length) return result;
  const signal = AbortSignal.timeout(15_000);
  let index = 0;
  async function worker() {
    while (index < urls.length && !signal.aborted) {
      const url = urls[index++],
        image = await loadImage(url, signal);
      if (image) result.set(url, image);
    }
  }
  await Promise.all(Array.from({ length: Math.min(3, urls.length) }, worker));
  return result;
};
