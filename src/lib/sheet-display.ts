import type { Sheet, SheetBody } from "./model";
export type SheetFilter = "all" | "draft" | "locked" | "printed";
export function sheetStatus(sheet: Sheet) {
  if (sheet.deleted_at) return "I papirkurven";
  if (sheet.printed_at) return "Utskrevet";
  return sheet.state === "locked" ? "Klar til utskrift" : "Utkast";
}
export function matchesSheetFilter(sheet: Sheet, filter: SheetFilter) {
  if (filter === "all") return true;
  if (filter === "printed") return Boolean(sheet.printed_at);
  return sheet.state === filter && !sheet.printed_at;
}
export function deletionDeadline(sheet: Sheet) {
  const dates = [
    sheet.delete_after ? new Date(sheet.delete_after).getTime() : Infinity,
    sheet.deleted_at
      ? new Date(sheet.deleted_at).getTime() + 7 * 86400000
      : Infinity,
  ];
  const time = Math.min(...dates);
  return Number.isFinite(time) ? new Date(time) : null;
}

/** A rebuilt merge allocates new row IDs; compare the content the user approved. */
export function mergeContentsMatch(a: SheetBody, b: SheetBody) {
  const content = (body: SheetBody) =>
    JSON.stringify({
      ...body,
      lines: body.lines.map(({ id, ...line }) => line),
    });
  return content(a) === content(b);
}
