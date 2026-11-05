// Local UI checks only. All application APIs are intercepted with synthetic data.
// PLAYWRIGHT_MODULE can point at a locally supplied Playwright installation.
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { PDFDocument } from "pdf-lib";
const { chromium } = await import(
  process.env.PLAYWRIGHT_MODULE || "playwright"
);
const output = resolve("output/design-qa");
await mkdir(output, { recursive: true });
const browser = await chromium.launch({
  headless: true,
  channel: process.env.BROWSER_CHANNEL || "chrome",
});
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const issues = [];
page.on("pageerror", (e) => issues.push(e.message));
const date = "2026-11-05";
const stamp = "2026-11-05T10:00:00Z";
const line = (name, quantity, ean = "7031157801014") => ({
  id: crypto.randomUUID(),
  name,
  quantity,
  ean,
});
const item = (title, extra = {}) => ({
  id: crypto.randomUUID(),
  owner_id: "ui-test",
  body: {
    title,
    date,
    location: "Gang 12",
    lines: [
      line("Terrasseskrue 4,2 × 55 mm, A4, 200 stk", 24),
      line("Gipsskrue 3,9 × 30 mm, 1000 stk", 8, "7025180735989"),
    ],
  },
  state: "draft",
  version: 1,
  revision: 0,
  created_at: stamp,
  updated_at: stamp,
  printed_at: null,
  deleted_at: null,
  delete_after: null,
  ...extra,
});
let sheets = [
  item("Skruer · reol 4"),
  item("Maling · reol 2", { state: "locked", revision: 1 }),
  item("Håndverktøy", {
    state: "locked",
    revision: 1,
    printed_at: stamp,
    delete_after: "2026-11-12T10:00:00Z",
  }),
  item("Gammel telling", { deleted_at: stamp }),
];
const area1 = item("Skruer 1");
area1.body.kind = "area";
const area2 = item("Skruer 2");
area2.body.kind = "area";
area2.body.lines[0].quantity = 6;
sheets.push(area1, area2);
let failSave = false,
  conflict = false,
  pdfRequests = 0,
  gateCode = 0;
const actions = [];
const doc = await PDFDocument.create();
doc.addPage([842, 1191]);
const pdf = await doc.save();
await page.route("**/merkelapp/api/**", async (route) => {
  const req = route.request(),
    p = new URL(req.url()).pathname,
    body = req.method() === "GET" ? null : req.postDataJSON();
  const send = (json, status = 200) => route.fulfill({ json, status });
  if (p.endsWith("/session") && gateCode)
    return send(
      {
        error:
          gateCode === 401
            ? "Økten er utløpt."
            : gateCode === 403
              ? "Kontoen har ikke tilgang."
              : "Tjenesten er utilgjengelig.",
      },
      gateCode,
    );
  if (p.endsWith("/session"))
    return send({
      name: "Demobruker",
      email: "demo@example.invalid",
      creatorName: "Demobruker",
      id: "ui-test",
      stores: [],
    });
  if (p.endsWith("/products")) return send({ status: "not_found" });
  if (p.endsWith("/layout"))
    return send(
      body.lines.length
        ? {
            ...(body.kind ? { area: true } : {}),
            pages: [
              {
                nameWidth: 390,
                quantityWidth: 100,
                barcodeWidth: 200,
                count: body.lines.length,
                fontSize: 24,
                lines: body.lines.map((l, i) => ({
                  id: l.id,
                  nameLines: [l.name],
                  nameSize: 22,
                  eanSize: 14,
                  quantitySize: 32,
                  height: 150,
                  stacked: false,
                  imageSize: 0,
                  imageGap: 0,
                  side: i % 2 ? "right" : "left",
                  calcLines: [],
                })),
              },
            ],
          }
        : { pages: [] },
    );
  if (p.endsWith("/pdf")) {
    pdfRequests++;
    return route.fulfill({
      body: Buffer.from(pdf),
      contentType: "application/pdf",
    });
  }
  if (p.endsWith("/sheets")) {
    if (req.method() === "GET") return send(sheets);
    const s = item(body.body.title, { id: body.id, body: body.body });
    sheets.unshift(s);
    actions.push("create");
    return send(s);
  }
  const s = sheets.find((s) => p.endsWith(s.id));
  if (!s) return send({ error: "Not found" }, 404);
  if (req.method() === "GET") return send(s);
  if (body.action === "save" && (failSave || conflict))
    return send(
      {
        error: conflict
          ? "Endret på en annen enhet."
          : "Kunne ikke lagre. Prøv igjen.",
      },
      conflict ? 409 : 503,
    );
  actions.push(body.action);
  if (body.action === "save") s.body = body.body;
  if (body.action === "lock") {
    s.state = "locked";
    s.revision++;
  }
  if (body.action === "reopen") {
    s.state = "draft";
    s.printed_at = null;
    s.delete_after = null;
  }
  if (body.action === "printed") {
    s.printed_at = stamp;
    s.delete_after = "2026-11-12T10:00:00Z";
  }
  if (body.action === "delete") s.deleted_at = stamp;
  if (body.action === "restore") s.deleted_at = null;
  s.version++;
  return send(s);
});
const checks = [];
async function shot(name) {
  await page.evaluate(() => {
    window.scrollTo(0, 0);
  });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(350);
  await page.screenshot({
    path: `${output}/${name}.png`,
    fullPage: page.viewportSize().width > 720,
  });
}
async function noOverflow(label) {
  const result = await page.evaluate(() => ({
    width: innerWidth,
    scroll: document.documentElement.scrollWidth,
  }));
  assert.ok(
    result.scroll <= result.width + 1,
    `${label}: ${JSON.stringify(result)}`,
  );
  checks.push({ label, ...result });
}
async function saved() {
  await page.locator("dialog[open]").waitFor({ state: "hidden" });
  await page.waitForTimeout(750);
  await page
    .locator(".save-status")
    .filter({ hasText: "Lagret på kontoen" })
    .waitFor();
  await page.waitForTimeout(150);
}
async function back() {
  await page.locator(".editor-back button").click();
}
try {
  await page.goto(
    process.env.DESIGN_TEST_URL || "http://localhost:3014/merkelapp",
    { waitUntil: "domcontentloaded" },
  );
  await page.getByRole("heading", { name: /Merkelapp/ }).waitFor();
  await shot("oversikt-desktop");
  await noOverflow("oversikt 1440");
  await page.getByRole("button", { name: "Utskrevet", exact: true }).click();
  assert.equal(await page.locator(".sheet-card").count(), 1);
  await page.getByRole("button", { name: "Alle", exact: true }).click();
  await page.getByRole("button", { name: /Skruer · reol 4/ }).click();
  await shot("telling-desktop");
  for (const width of [320, 390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await noOverflow(`telling ${width}`);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await shot("telling-mobil");
  await page.getByRole("button", { name: "Detaljer", exact: true }).click();
  await page
    .getByLabel("Navn på lappen", { exact: true })
    .filter({ visible: true })
    .fill("Skruer · oppdatert");
  await page.getByRole("button", { name: "Lagre detaljer" }).click();
  await page.getByRole("dialog").waitFor({ state: "hidden" });
  assert.equal(sheets[0].body.title, "Skruer · oppdatert");
  await page
    .getByRole("button", { name: "Legg til manuelt", exact: true })
    .click();
  await page
    .getByRole("textbox", { name: "EAN", exact: true })
    .fill("7031157801014");
  await page.getByRole("textbox", { name: "Antall", exact: true }).fill("6");
  await page
    .getByRole("textbox", { name: "Varenavn", exact: true })
    .fill("Terrasseskrue 4,2 × 55 mm, A4, 200 stk");
  await shot("vare-mobil");
  const add = page.getByRole("button", { name: /Legg til 6/ });
  if (!(await add.count()))
    await page
      .getByRole("button", { name: "Legg til og lukk", exact: true })
      .click();
  await add.click();
  await saved();
  assert.equal(sheets[0].body.lines[0].quantity, 30);
  await page.getByRole("button", { name: /Rediger Terrasseskrue/ }).click();
  await page.getByRole("button", { name: "Fjern vare", exact: true }).click();
  await page.getByRole("button", { name: "Angre", exact: true }).click();
  await saved();
  assert.equal(sheets[0].body.lines.length, 2);
  await page.getByRole("button", { name: "Skann vare", exact: false }).click();
  await page.getByRole("dialog").waitFor();
  await page
    .getByRole("button", { name: "Skriv EAN manuelt", exact: true })
    .click();
  await page
    .getByRole("heading", { name: "Legg til vare", exact: true })
    .waitFor();
  await page.keyboard.press("Escape");
  assert.equal(await page.locator("dialog[open]").count(), 0);
  await page.getByRole("button", { name: "Se utskrift", exact: true }).click();
  await page
    .getByRole("button", { name: "Lås lapp for utskrift", exact: true })
    .click();
  await page.getByRole("heading", { name: "1. Lappen er låst" }).waitFor();
  await page.setViewportSize({ width: 1440, height: 1000 });
  await shot("utskrift-desktop");
  for (const width of [320, 390, 768, 1024]) {
    await page.setViewportSize({ width, height: 900 });
    await noOverflow(`utskrift ${width}`);
  }
  await page.getByRole("button", { name: "Åpne PDF", exact: true }).click();
  await page
    .getByText("PDF klar. Velg A3 og faktisk størrelse / 100 %.")
    .waitFor();
  assert.equal(pdfRequests, 1);
  assert.equal(sheets[0].printed_at, null);
  await page
    .getByRole("button", { name: "Markér som skrevet ut", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Markert som skrevet ut", exact: true })
    .waitFor();
  assert.ok(sheets[0].printed_at);
  await page
    .getByRole("button", { name: "Åpne for redigering", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Lås lapp for utskrift", exact: true })
    .waitFor();
  assert.equal(sheets[0].delete_after, null);
  await back();
  await page.getByRole("button", { name: "Områdelister", exact: true }).click();
  await page
    .getByRole("checkbox", { name: "Velg Skruer 1 for sammenslåing" })
    .check();
  await page
    .getByRole("checkbox", { name: "Velg Skruer 2 for sammenslåing" })
    .check();
  await page.getByRole("button", { name: /Se sammenslåing/ }).click();
  await page.getByRole("dialog").waitFor();
  await shot("sammenslaing");
  area2.body.lines[0].quantity = 10;
  await page
    .getByRole("button", { name: "Slå sammen 2 lister", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByText(/En kildeliste er endret/)
    .waitFor();
  await page
    .getByRole("button", { name: "Slå sammen 2 lister", exact: true })
    .click();
  await page.getByRole("dialog").waitFor({ state: "hidden" });
  await page
    .getByRole("heading", { name: "Skruer samlet", exact: true })
    .waitFor();
  assert.equal(sheets[0].body.lines[0].quantity, 34);
  await shot("sammenslatt");
  await page.locator(".sheet-menu:not([open]) summary").click();
  await page.getByRole("button", { name: "Slett lapp", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Avbryt", exact: true })
    .click();
  assert.equal(sheets[0].deleted_at, null);
  await page.getByRole("button", { name: "Slett lapp", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Flytt til papirkurv", exact: true })
    .click();
  await page.getByRole("heading", { name: /Områdelister/ }).waitFor();
  assert.ok(sheets[0].deleted_at);
  await page.getByRole("button", { name: "Papirkurv", exact: true }).click();
  assert.equal(await page.locator(".sheet-card").count(), 2);
  await page.getByRole("button", { name: /Skruer samlet/ }).click();
  await page
    .getByRole("button", { name: "Gjenopprett lapp", exact: true })
    .click();
  await page.locator(".sheet-menu").waitFor({ state: "visible" });
  assert.equal(sheets[0].deleted_at, null);
  await back();
  await page.getByRole("button", { name: "Merkelapp", exact: true }).click();
  await page.getByRole("button", { name: /Skruer · oppdatert/ }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  failSave = true;
  await page.getByRole("button", { name: /Rediger Terrasseskrue/ }).click();
  await page.getByRole("textbox", { name: "Antall", exact: true }).fill("31");
  await page
    .getByRole("button", { name: "Lagre endring", exact: true })
    .click();
  await page.getByText("Ikke lagret", { exact: true }).waitFor();
  await shot("lagringsfeil");
  failSave = false;
  await page.getByRole("button", { name: "Prøv igjen", exact: true }).click();
  await saved();
  await back();
  await page.getByRole("textbox", { name: "Søk i lapper" }).fill("finnesikke");
  await page.getByText("Ingen lapper passer søket.").waitFor();
  await page.getByRole("button", { name: "Nullstill søk og filter" }).click();
  for (const width of [320, 390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await noOverflow(`oversikt ${width}`);
  }
  // Dialog focus and width, failed detail save, and version conflict recovery.
  await page.getByRole("button", { name: /Skruer · oppdatert/ }).click();
  await page.setViewportSize({ width: 320, height: 720 });
  await page.getByRole("button", { name: "Detaljer", exact: true }).click();
  await noOverflow("detaljer 320");
  for (let i = 0; i < 12; i++) {
    await page.keyboard.press("Tab");
    assert.ok(
      await page.evaluate(() => !!document.activeElement?.closest("dialog")),
      "dialog contains keyboard focus",
    );
  }
  failSave = true;
  await page
    .getByRole("dialog")
    .getByLabel("Navn på lappen", { exact: true })
    .fill("Skal ikke lagres");
  await page.getByRole("button", { name: "Lagre detaljer" }).click();
  await page
    .getByRole("dialog")
    .getByText(/Detaljene kunne ikke lagres/)
    .waitFor();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Avbryt" })
    .click();
  failSave = false;
  assert.notEqual(
    sheets.find((s) => s.body.title === "Skruer · oppdatert")?.body.title,
    "Skal ikke lagres",
  );
  conflict = true;
  await page.getByRole("button", { name: /Rediger Terrasseskrue/ }).click();
  await noOverflow("vare 320");
  await page.getByRole("textbox", { name: "Antall", exact: true }).fill("32");
  await page
    .getByRole("button", { name: "Lagre endring", exact: true })
    .click();
  await page.getByRole("button", { name: "Last inn lagret versjon" }).waitFor();
  conflict = false;
  await page.getByRole("button", { name: "Last inn lagret versjon" }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Last inn versjonen" })
    .click();
  await saved();
  await back();
  await page.getByRole("button", { name: "Ny lapp", exact: true }).click();
  await page.getByRole("heading", { name: "Klar for første vare" }).waitFor();
  await noOverflow("tom lapp 320");
  await shot("tom-lapp-mobil");
  await page.getByRole("button", { name: "Se utskrift", exact: true }).click();
  assert.ok(
    await page
      .getByRole("button", { name: "Lås lapp for utskrift" })
      .isDisabled(),
  );
  for (const code of [401, 403, 503]) {
    gateCode = code;
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.locator(".gate h1").waitFor();
    await noOverflow("tilgang " + code);
    if (code === 401)
      assert.ok(
        await page
          .getByRole("link", { name: "Logg inn", exact: true })
          .isVisible(),
      );
    if (code === 503)
      assert.ok(
        await page
          .getByRole("button", { name: "Prøv igjen", exact: true })
          .isVisible(),
      );
  }
  assert.deepEqual(issues, []);
  await writeFile(
    `${output}/results.json`,
    JSON.stringify({ checks, actions, pageErrors: issues }, null, 2),
  );
  console.log(
    `PASS: ${checks.length} viewport checks; add/duplicate/undo/scanner/manual/details/lock/PDF/print/reopen/merge-source-change/delete/restore/save-retry/search.`,
  );
} finally {
  await browser.close();
}
