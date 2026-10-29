import { test } from "node:test";
import assert from "node:assert/strict";
import { creatorName } from "../src/lib/creator-name";
test("print attribution uses first name and final surname initial", () => {
  for (const [name, expected] of [
    ["Ole Petter Kristiansen", "Ole K."],
    ["Mats Leine", "Mats L."],
    ["Camilla Gjertsen", "Camilla G."],
    ["Aleksander Sommerfryd Jensen", "Aleksander J."],
    [" Ole K. ", "Ole K."],
    ["Åse Ødegård", "Åse Ø."],
  ])
    assert.equal(
      creatorName({ user_metadata: { display_name: name } }),
      expected,
    );
  assert.equal(
    creatorName({ user_metadata: {}, email: "mats.leine@example.no" }),
    "mats L.",
  );
  assert.equal(creatorName({ user_metadata: { display_name: {} } }), "Bruker");
});
