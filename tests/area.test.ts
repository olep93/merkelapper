import { test } from "node:test";
import assert from "node:assert/strict";
import { PDFDocument } from "pdf-lib";
import {
  AREA_ROWS_PER_PAGE,
  calculation,
  changedSources,
  countFingerprint,
  mergedInto,
  mergeSheets,
  inStore,
  mergedTitle,
  nextAreaTitle,
} from "../src/lib/area";
import { fonts,
  planAreaPages,
  planPages,
} from "../src/lib/layout";
import { bodySchema, type Line, type Sheet, type SheetBody } from "../src/lib/model";
import { makePdf } from "../src/lib/pdf";
const A = "7025180735989",
  B = "3253560306977",
  C = "7029350011217";
const line = (ean: string, quantity: number, name = `Vare ${ean}`): Line => ({
  id: crypto.randomUUID(),
  ean,
  name,
  quantity,
});
const sheet = (
  title: string,
  lines: Line[],
  extra: Partial<Sheet> = {},
): Sheet => ({
  id: crypto.randomUUID(),
  owner_id: crypto.randomUUID(),
  owner_name: null,
  store_id: null,
  body: { title, date: "2026-11-03", location: "", kind: "area", lines },
  state: "draft",
  version: 1,
  revision: 0,
  created_at: "2026-11-03T10:00:00Z",
  updated_at: "2026-11-03T10:00:00Z",
  printed_at: null,
  delete_after: null,
  deleted_at: null,
  ...extra,
});
test("merging adds equal EANs and records the calculation in list order", () => {
  const body = mergeSheets([
    sheet("Skruer 10", [line(A, 30)]),
    sheet("Skruer 2", [line(A, 8), line(C, 4)]),
    sheet("Skruer 1", [line(B, 5), line(A, 12)]),
  ]);
  assert.equal(body.title, "Skruer samlet");
  assert.equal(body.kind, "merged");
  assert.deepEqual(
    body.sources?.map((s) => s.title),
    ["Skruer 1", "Skruer 2", "Skruer 10"],
  );
  assert.deepEqual(
    body.lines.map((l) => [l.ean, l.quantity, calculation(l)]),
    [
      [B, 5, ""],
      [A, 50, "12 + 8 + 30"],
      [C, 4, ""],
    ],
  );
  assert.equal(bodySchema.safeParse(body).success, true);
});
test("zero counts stay on the merged list and source lines are not mutated", () => {
  const first = line(A, 0);
  const body = mergeSheets([sheet("A", [first]), sheet("B", [line(A, 3)])]);
  assert.equal(body.lines[0].quantity, 3);
  assert.equal(calculation(body.lines[0]), "0 + 3");
  assert.equal(first.quantity, 0);
  assert.equal(first.parts, undefined);
});
test("merge refuses totals and item counts the sheet cannot hold", () => {
  assert.throws(() =>
    mergeSheets([
      sheet("A", [line(A, Number.MAX_SAFE_INTEGER)]),
      sheet("B", [line(A, 1)]),
    ]),
  );
  const eans = Array.from({ length: 501 }, (_, i) => {
    const code = String(1000000 + i);
    const sum = [...code].reduce(
      (n, d, j) => n + Number(d) * (j % 2 ? 1 : 3),
      0,
    );
    return code + ((10 - (sum % 10)) % 10);
  });
  assert.throws(
    () =>
      mergeSheets([
        sheet("A", eans.slice(0, 300).map((e) => line(e, 1))),
        sheet("B", eans.slice(300).map((e) => line(e, 1))),
      ]),
    /over 500/,
  );
});
test("schema keeps the list kind and rejects a calculation that does not add up", () => {
  const body = mergeSheets([
    sheet("A", [line(A, 2)]),
    sheet("B", [line(A, 3)]),
  ]);
  assert.equal(bodySchema.parse(body).kind, "merged");
  assert.equal(bodySchema.parse(body).lines[0].parts?.length, 2);
  const wrong: SheetBody = {
    ...body,
    lines: [{ ...body.lines[0], quantity: 6 }],
  };
  assert.equal(bodySchema.safeParse(wrong).success, false);
  const unknownSource: SheetBody = {
    ...body,
    lines: [{ ...body.lines[0], parts: [{ source: 9, quantity: 5 }] }],
  };
  assert.equal(bodySchema.safeParse(unknownSource).success, false);
});
test("titles continue a numbered series", () => {
  const list = [
    sheet("Skruer 1", [], { created_at: "2026-11-03T10:00:00Z" }),
    sheet("Skruer 3", [], { created_at: "2026-11-03T11:00:00Z" }),
  ];
  assert.equal(nextAreaTitle(list), "Skruer 4");
  assert.equal(nextAreaTitle([]), "");
  assert.equal(nextAreaTitle([sheet("Lager", [])]), "");
  assert.equal(mergedTitle(["Skruer 1", "Bolter 2"]), "Sammenslått liste");
});
test("a changed source is flagged, but locking without a count change is not", () => {
  const source = sheet("A", [line(A, 2)]);
  const other = sheet("B", [line(A, 3)]);
  const body = mergeSheets([source, other]);
  assert.deepEqual(
    changedSources(body, [{ ...source, state: "locked", version: 2 }, other]),
    [],
  );
  const edited = {
    ...source,
    body: { ...source.body, lines: [line(A, 9)] },
  };
  assert.deepEqual(
    changedSources(body, [edited, other]).map((s) => s.title),
    ["A"],
  );
  assert.equal(
    countFingerprint(source.body),
    countFingerprint({
      ...source.body,
      lines: [{ ...source.body.lines[0], id: crypto.randomUUID() }],
    }),
  );
});
const many = (count: number) =>
  Array.from({ length: count }, (_, i) => line(A, i + 1, `Vare nummer ${i + 1}`));
test("rows alternate sides, restart per page and hold at most 25 per page", async () => {
  const { font, bold } = await fonts();
  const pages = planAreaPages(many(26), font, bold);
  assert.deepEqual(
    pages.map((p) => p.rows.length),
    [AREA_ROWS_PER_PAGE, 1],
  );
  assert.deepEqual(
    pages[0].rows.slice(0, 4).map((r) => r.side),
    ["right", "left", "right", "left"],
  );
  assert.equal(pages[1].rows[0].side, "right");
});
test("long names stay within two lines and long calculations collapse", async () => {
  const { font, bold } = await fonts();
  const [page] = planAreaPages(
    [
      {
        ...line(A, 7 * 40),
        name: "Skrue ".repeat(83),
        parts: Array.from({ length: 40 }, (_, source) => ({
          source,
          quantity: 7,
        })),
      },
    ],
    font,
    bold,
  );
  const row = page.rows[0];
  assert.equal(row.nameLines.length, 2);
  assert.ok(row.nameLines[1].endsWith("…"));
  for (const text of row.nameLines)
    assert.ok(bold.widthOfTextAtSize(text, row.nameSize) <= page.nameWidth - 12);
  assert.deepEqual(row.calcLines, ["Sum av 40 lister"]);
});
test("area PDFs are A3, use no product images and leave normal sheets alone", async () => {
  const { bytes, pages } = await makePdf(
    {
      title: "Skruer 1",
      date: "2026-11-03",
      location: "",
      kind: "area",
      lines: many(26).map((l) => ({
        ...l,
        product: {
          ean: A,
          name: l.name,
          source: "Obs BYGG" as const,
          sourceUrl: "https://www.obsbygg.no/p",
          imageUrl: "https://www.obsbygg.no/globalassets/bilder/x.jpg",
          fetchedAt: "2026-11-03T10:00:00.000Z",
        },
      })),
    },
    "12345678-0000-4000-8000-000000000000",
    1,
    {
      imageLoader: async () => {
        throw new Error("Area sheets must not load images.");
      },
    },
  );
  assert.equal(pages, 2);
  const { width, height } = (await PDFDocument.load(bytes)).getPage(0).getSize();
  assert.equal(Math.round((width * 25.4) / 72), 297);
  assert.equal(Math.round((height * 25.4) / 72), 420);
  const { font, bold } = await fonts();
  assert.equal(planPages(many(12), font, bold).length, 2);
});
test("a store view holds its own shared lists and the user's private lists", () => {
  const here = sheet("Skruer 1", [], { store_id: "a" }),
    elsewhere = sheet("Skruer 2", [], { store_id: "b" }),
    colleague = sheet("Skruer 3", [], { store_id: "a" }),
    privateList = sheet("Skruer 4", []);
  assert.deepEqual(
    inStore([here, elsewhere, colleague, privateList], "a"),
    [here, colleague, privateList],
  );
  assert.equal(nextAreaTitle(inStore([elsewhere, here], "a")), "Skruer 2");
});

test("merging leaves the source lists untouched and links them to the new list", () => {
  const one = sheet("Skruer 1", [line(A, 12)]);
  const two = sheet("Skruer 2", [line(A, 8)]);
  const before = JSON.stringify([one, two]);
  const body = mergeSheets([one, two]);
  assert.equal(JSON.stringify([one, two]), before);
  const merged = {
    ...sheet("Skruer samlet", body.lines),
    body,
  } as unknown as Sheet;
  const all = [one, two, merged] as unknown as Sheet[];
  assert.deepEqual(mergedInto(one.id, all), [merged]);
  assert.deepEqual(mergedInto(merged.id, all), []);
  assert.deepEqual(
    mergedInto(one.id, [
      one,
      { ...merged, deleted_at: "2026-11-03T10:00:00Z" },
    ] as unknown as Sheet[]),
    [],
  );
});
