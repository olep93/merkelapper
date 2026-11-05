import { dateLabel, osloDate, type Line, type Sheet, type SheetBody } from "./model";
type Source = Pick<Sheet, "id" | "body">;
export const AREA_ROWS_PER_PAGE = 25,
  AREA_EAN_SIZE = 10,
  AREA_CALC_SIZE = 7.5;
export function sheetTitle(body: SheetBody) {
  return body.title || `Lapp ${dateLabel(body.date)}`;
}
const titleBase = (title: string) => title.replace(/\s*\d+$/, "").trim();
// Private lists follow the user, while shared lists belong to one store.
export function inStore(sheets: Sheet[], storeId: string) {
  return sheets.filter((s) => !s.store_id || s.store_id === storeId);
}
// A page opened before an update may not send a store. A list is still shared when the choice is clear.
export function storeForNewSheet(
  body: SheetBody,
  requested: string | undefined,
  stores: { id: string }[],
) {
  if (requested || !body.kind) return requested;
  return stores.length === 1 ? stores[0].id : undefined;
}
// Suggests the next name in a numbered series: "Skruer 3" gives "Skruer 4".
export function nextAreaTitle(sheets: Sheet[]) {
  const areas = sheets.filter((s) => s.body.kind === "area" && !s.deleted_at);
  const latest = areas.reduce<Sheet | null>(
    (a, b) => (!a || b.created_at > a.created_at ? b : a),
    null,
  );
  if (!latest || !/\d+$/.test(latest.body.title)) return "";
  const base = titleBase(latest.body.title);
  const numbers = areas
    .filter((s) => titleBase(s.body.title) === base)
    .map((s) => Number(s.body.title.match(/\d+$/)?.[0] || 0));
  return `${base} ${Math.max(...numbers) + 1}`.trim().slice(0, 100);
}
export function mergedTitle(titles: string[]) {
  const base = titleBase(titles[0] || "");
  return base && titles.every((t) => titleBase(t) === base)
    ? `${base} samlet`.slice(0, 100)
    : "Sammenslått liste";
}
// Detects later count changes in a source. Locking and printing leave it unchanged.
export function countFingerprint(body: SheetBody) {
  let hash = 5381;
  const text = body.lines
    .map((l) => `${l.ean}:${l.quantity}`)
    .sort()
    .join(",");
  for (let i = 0; i < text.length; i++)
    hash = (hash * 33 + text.charCodeAt(i)) >>> 0;
  return hash.toString(16);
}
// Summing a merged list with one of its own sublists would count those items twice.
export function doubleCounted(chosen: Sheet[], sheets: Sheet[]) {
  const within = (id: string, seen = new Set<string>()): Set<string> => {
    for (const source of sheets.find((s) => s.id === id)?.body.sources || [])
      if (!seen.has(source.id)) {
        seen.add(source.id);
        within(source.id, seen);
      }
    return seen;
  };
  for (const outer of chosen) {
    const inner = within(outer.id);
    const list = chosen.find((s) => inner.has(s.id));
    if (list)
      return { list: sheetTitle(list.body), within: sheetTitle(outer.body) };
  }
  return null;
}
export function mergeSheets(sources: Source[], date = osloDate()): SheetBody {
  const ordered = [...sources].sort((a, b) =>
    sheetTitle(a.body).localeCompare(sheetTitle(b.body), "nb", {
      numeric: true,
    }),
  );
  const lines = new Map<string, Line & { parts: NonNullable<Line["parts"]> }>();
  ordered.forEach((sheet, source) => {
    for (const line of sheet.body.lines) {
      const merged = lines.get(line.ean);
      if (!merged) {
        lines.set(line.ean, {
          ...line,
          id: crypto.randomUUID(),
          parts: [{ source, quantity: line.quantity }],
        });
        continue;
      }
      merged.quantity += line.quantity;
      if (!Number.isSafeInteger(merged.quantity))
        throw new Error(`Summen for ${line.name} er for stor.`);
      merged.parts.push({ source, quantity: line.quantity });
      merged.product ??= line.product;
    }
  });
  if (lines.size > 500)
    throw new Error(
      "Sammenslåingen gir over 500 ulike varer. Velg færre lister.",
    );
  const locations = new Set(ordered.map((s) => s.body.location));
  return {
    title: mergedTitle(ordered.map((s) => sheetTitle(s.body))),
    date,
    location: locations.size === 1 ? ordered[0].body.location : "",
    kind: "merged",
    sources: ordered.map((s) => ({
      id: s.id,
      title: sheetTitle(s.body),
      fingerprint: countFingerprint(s.body),
    })),
    lines: [...lines.values()],
  };
}
// A merged list always follows its sublists. A sublist in the trash stays linked but counts for nothing,
// so restoring it brings the numbers back. Returns null when the stored list is already correct.
function resolveMerged(
  sheet: Sheet,
  sheets: Sheet[],
  path: string[] = [],
): SheetBody {
  if (sheet.body.kind !== "merged" || !sheet.body.sources?.length)
    return sheet.body;
  const live = sheet.body.sources
    .map((source) =>
      sheets.find(
        (s) => s.id === source.id && !s.deleted_at && !path.includes(s.id),
      ),
    )
    .filter((s): s is Sheet => Boolean(s));
  if (!live.length) return sheet.body;
  const next = mergeSheets(
    live.map((s) => ({
      id: s.id,
      body: resolveMerged(s, sheets, [...path, sheet.id]),
    })),
    sheet.body.date,
  );
  const known = new Map(sheet.body.lines.map((l) => [l.ean, l]));
  return {
    ...sheet.body,
    sources: [
      ...next.sources!,
      ...sheet.body.sources.filter(
        (source) => !next.sources!.some((s) => s.id === source.id),
      ),
    ],
    lines: next.lines.map((l) => ({
      ...l,
      id: known.get(l.ean)?.id ?? l.id,
      name: known.get(l.ean)?.name ?? l.name,
    })),
  };
}
// The database stores JSON with its own key order, so only the content can be compared.
function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : 1))
      .map(([k, v]) => [k, canonical(v)]),
  );
}
export function refreshedMerged(sheet: Sheet, sheets: Sheet[]) {
  const next = resolveMerged(sheet, sheets);
  return JSON.stringify(canonical(next)) ===
    JSON.stringify(canonical(sheet.body))
    ? null
    : next;
}
export function changedSources(body: SheetBody, sheets: Sheet[]) {
  return (body.sources || []).filter((source) => {
    const sheet = sheets.find((s) => s.id === source.id);
    return (
      sheet &&
      !sheet.deleted_at &&
      countFingerprint(sheet.body) !== source.fingerprint
    );
  });
}
// The merged lists a source list has gone into. The source itself stays as it was.
export function mergedInto(id: string, sheets: Sheet[]) {
  return sheets.filter(
    (s) =>
      s.body.kind === "merged" &&
      !s.deleted_at &&
      s.body.sources?.some((source) => source.id === id),
  );
}
const SOURCE_COLORS = [
  "#2563d9",
  "#e0701d",
  "#2a9266",
  "#a34fc4",
  "#c9304f",
  "#0f8fa8",
  "#a98a12",
  "#5b6577",
];
// One colour per sublist, so a list and its numbers can be matched at a glance.
export const sourceColor = (index: number) =>
  SOURCE_COLORS[index % SOURCE_COLORS.length];
// A calculation only adds information when more than one list holds the item.
export function calculation(line: Line) {
  return line.parts && line.parts.length > 1
    ? line.parts.map((p) => p.quantity).join(" + ")
    : "";
}
