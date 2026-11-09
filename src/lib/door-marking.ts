import { validEan } from "./model";
export type DoorDetails = {
  width: string;
  height: string;
  handing: "" | "H" | "V" | "Vendbar";
};
/** Only parse explicit units and direction on the verified variant, never the shared description. */
export function doorDetails(size: string): DoorDetails {
  const match = size.match(
    /\b(\d+(?:[.,]\d+)?)\s*[x×]\s*(\d+(?:[.,]\d+)?)\s*(cm|mm)\b/i,
  );
  const unit = match?.[3].toLowerCase() === "mm" ? 10 : 1;
  const directions = [
    ...size.matchAll(/\b(H|V|høyre|venstre|vendbar)\b/gi),
  ].map((m) => m[1].toLowerCase());
  const sides = new Set(
    directions.map((d) =>
      d === "h" || d === "høyre"
        ? "H"
        : d === "v" || d === "venstre"
          ? "V"
          : "Vendbar",
    ),
  );
  return {
    width: match ? String(Number(match[1].replace(",", ".")) / unit) : "",
    height: match ? String(Number(match[2].replace(",", ".")) / unit) : "",
    handing: sides.size === 1 ? ([...sides][0] as DoorDetails["handing"]) : "",
  };
}
export function readyToPrint(
  ean: string,
  name: string,
  details: DoorDetails,
  points: string[],
) {
  return (
    validEan(ean) &&
    !!name.trim() &&
    name.length <= 160 &&
    !!details.handing &&
    [details.width, details.height].every(
      (v) =>
        /^\d+(?:[.,]\d+)?$/.test(v) &&
        Number(v.replace(",", ".")) > 0 &&
        Number(v.replace(",", ".")) <= 600,
    ) &&
    points.length > 0 &&
    points.length <= 5 &&
    points.every((p) => p.length <= 180)
  );
}

export type DoorLabelData = {
  ean: string;
  name: string;
  details: DoorDetails;
  points: string[];
  product: import("./products").Product;
};
export type DoorPage = [DoorLabelData | null, DoorLabelData | null];

/** Fill an existing gap before allocating another A4 sheet. */
export function nextDoorSlot(pages: DoorPage[]): [number, number] | null {
  for (let page = 0; page < pages.length; page++) {
    const slot = pages[page].findIndex((label) => label === null);
    if (slot !== -1) return [page, slot];
  }
  return pages.length < 30 ? [pages.length, 0] : null;
}
