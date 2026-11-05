import { test } from "node:test";
import assert from "node:assert/strict";
import {
  canEditSheet,
  deletionDeadline,
  matchesSheetFilter,
  mergeContentsMatch,
  sheetStatus,
} from "../src/lib/sheet-display";
import { mergeSheets } from "../src/lib/area";
import { emptyBody, type Sheet } from "../src/lib/model";
const base = {
  id: crypto.randomUUID(),
  body: emptyBody(),
  state: "draft",
  printed_at: null,
  deleted_at: null,
  delete_after: null,
} as Sheet;
test("printed sheets are distinct from ready sheets and trash takes status precedence", () => {
  const ready = { ...base, state: "locked" as const };
  const printed = { ...ready, printed_at: "2026-11-05T10:00:00Z" };
  assert.equal(matchesSheetFilter(ready, "locked"), true);
  assert.equal(matchesSheetFilter(printed, "locked"), false);
  assert.equal(matchesSheetFilter(printed, "printed"), true);
  assert.equal(sheetStatus(printed), "Utskrevet");
  assert.equal(
    sheetStatus({ ...printed, deleted_at: "2026-11-05T10:00:00Z" }),
    "I papirkurven",
  );
});
test("trash preserves an earlier print expiry", () => {
  const deleted = { ...base, deleted_at: "2026-11-05T10:00:00Z" };
  assert.equal(
    deletionDeadline(deleted)?.toISOString(),
    "2026-11-12T10:00:00.000Z",
  );
  assert.equal(
    deletionDeadline({
      ...deleted,
      delete_after: "2026-11-07T10:00:00Z",
    })?.toISOString(),
    "2026-11-07T10:00:00.000Z",
  );
  assert.equal(deletionDeadline(base), null);
});
test("merge confirmation ignores newly allocated IDs but detects changed counts and source metadata", () => {
  const source = {
    ...base,
    body: {
      ...emptyBody(),
      kind: "area" as const,
      title: "Skruer 1",
      lines: [
        {
          id: crypto.randomUUID(),
          name: "Skruer",
          ean: "7031157801013",
          quantity: 2,
        },
      ],
    },
  };
  const first = mergeSheets([source], "2026-11-05");
  const second = mergeSheets([source], "2026-11-05");
  assert.notEqual(first.lines[0].id, second.lines[0].id);
  assert.equal(mergeContentsMatch(first, second), true);
  assert.equal(
    mergeContentsMatch(first, {
      ...second,
      lines: [{ ...second.lines[0], quantity: 3 }],
    }),
    false,
  );
  assert.equal(
    mergeContentsMatch(first, { ...second, location: "Ny plass" }),
    false,
  );
});

test("only the extended account can edit a colleague's shared list", () => {
  const shared = { owner_id: "kari", store_id: "tonsberg" },
    privateSheet = { owner_id: "kari", store_id: null };
  assert.equal(canEditSheet(shared, { id: "kari" }), true);
  assert.equal(canEditSheet(shared, { id: "ola" }), false);
  assert.equal(canEditSheet(shared, { id: "ola", canEditOthers: true }), true);
  assert.equal(
    canEditSheet(privateSheet, { id: "ola", canEditOthers: true }),
    false,
  );
});
