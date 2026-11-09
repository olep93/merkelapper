"use client";
import { useEffect, useRef, useState } from "react";
import { Printer, ScanLine, Search, Plus, Save } from "lucide-react";
import { Scanner } from "./scanner";
import { DoorLabel } from "./door-label";
import { z } from "zod";
import { productSchema } from "@/lib/model";
import { validEan } from "@/lib/model";
import {
  doorDetails,
  readyToPrint,
  type DoorDetails,
  type DoorLabelData,
  type DoorPage,
} from "@/lib/door-marking";
import type { Product } from "@/lib/products";
import "./door-marking.css";

const savedLabelSchema = z
  .object({
    ean: z.string(),
    name: z.string(),
    details: z.object({
      width: z.string(),
      height: z.string(),
      handing: z.enum(["", "H", "V", "Vendbar"]),
    }),
    points: z.array(z.string()),
    product: productSchema,
  })
  .refine(
    (d) =>
      d.product.selectedVariantVerified &&
      d.product.ean === d.ean &&
      !!d.product.imageUrl &&
      readyToPrint(d.ean, d.name, d.details, d.points),
  );
const bookSchema = z
  .array(z.tuple([savedLabelSchema.nullable(), savedLabelSchema.nullable()]))
  .min(1)
  .max(30);
export function DoorMarking({ accountId }: { accountId: string }) {
  const [ean, setEan] = useState("");
  const [product, setProduct] = useState<Product | null>(null);
  const [name, setName] = useState("");
  const [details, setDetails] = useState<DoorDetails>(doorDetails(""));
  const [argumentsText, setArgumentsText] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [scanner, setScanner] = useState(false);
  const [pages, setPages] = useState<DoorPage[]>([[null, null]]);
  const [active, setActive] = useState<[number, number]>([0, 0]);
  const [storageError, setStorageError] = useState("");
  const storageKey = `merkelapp-doors-v1-${accountId}`;
  useEffect(() => {
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const restored = bookSchema.safeParse(JSON.parse(stored));
        if (restored.success) {
          setPages(restored.data as DoorPage[]);
          setActive([0, 0]);
          loadDraft(restored.data[0][0] as DoorLabelData | null);
        } else
          setStorageError(
            "Tidligere dørark kunne ikke leses. Lag nye merker med et kontrollert produktoppslag.",
          );
      }
    } catch {
      setStorageError(
        "Lokal lagring er utilgjengelig. Behold fanen åpen til du har skrevet ut.",
      );
    }
  }, [storageKey]);
  const [confirmed, setConfirmed] = useState(false);
  const [imageStates, setImageStates] = useState<
    Partial<Record<string, "ready" | "missing">>
  >({});
  const imageState = product?.imageUrl
    ? imageStates[product.imageUrl] || "loading"
    : "missing";
  function onImage(url: string, state: "ready" | "missing") {
    setImageStates((previous) =>
      previous[url] === state ? previous : { ...previous, [url]: state },
    );
  }
  const [layoutFits, setLayoutFits] = useState(true);
  const sheetRef = useRef<HTMLDivElement>(null);
  const generation = useRef(0);
  useEffect(
    () => () => {
      generation.current++;
    },
    [],
  );
  const points = argumentsText
    .split("\n")
    .map((p) => p.trim())
    .filter(Boolean);
  const fieldsValid = readyToPrint(ean, name, details, points);
  const ready =
    fieldsValid && layoutFits && confirmed && imageState === "ready" && !busy;
  useEffect(() => {
    const measure = () =>
      setLayoutFits(
        Array.from(
          sheetRef.current?.querySelectorAll(".door-label") || [],
        ).every((label) => label.scrollHeight <= label.clientHeight + 1),
      );
    const observer = new ResizeObserver(measure);
    if (sheetRef.current) {
      observer.observe(sheetRef.current);
      sheetRef.current
        .querySelectorAll("article > *")
        .forEach((el) => observer.observe(el));
    }
    measure();
    return () => observer.disconnect();
  }, [name, argumentsText, details, pages, active, imageStates]);
  const currentDraft = { ean, name, details, points, product };
  const saved = pages[active[0]]?.[active[1]] || null;
  const dirty = saved
    ? JSON.stringify(currentDraft) !== JSON.stringify(saved)
    : !!(ean || name || product);
  const savedLabels = pages.flat().filter((d): d is DoorLabelData => !!d);
  const canPrint =
    savedLabels.length > 0 &&
    !dirty &&
    !busy &&
    layoutFits &&
    savedLabels.every((d) => imageStates[d.product.imageUrl!] === "ready");
  function loadDraft(data: DoorLabelData | null) {
    generation.current++;
    setBusy(false);
    setMessage("");
    setEan(data?.ean || "");
    setName(data?.name || "");
    setProduct(data?.product || null);
    setDetails(data?.details || doorDetails(""));
    setArgumentsText(data?.points.join("\n") || "");
    setConfirmed(!!data);
  }
  function storePages(next: DoorPage[]) {
    setPages(next);
    try {
      localStorage.setItem(storageKey, JSON.stringify(next));
      setStorageError("");
    } catch {
      setStorageError(
        "Kunne ikke lagre på denne enheten. Merkene finnes bare i den åpne fanen; skriv ut før du lukker.",
      );
    }
  }
  function saveLabel() {
    if (!ready || !product) return;
    const next = pages.map((page) => [...page] as DoorPage);
    next[active[0]][active[1]] = {
      ean,
      name,
      details: { ...details },
      points: [...points],
      product,
    };
    storePages(next);
    setMessage(
      `Dørmerket er lagt på side ${active[0] + 1}, plass ${active[1] + 1}.`,
    );
  }
  function selectSlot(page: number, slot: number) {
    if (dirty || busy) return;
    setActive([page, slot]);
    loadDraft(pages[page][slot]);
  }
  function addPage() {
    if (dirty || busy || !pages[active[0]].some(Boolean) || pages.length >= 30)
      return;
    storePages([...pages, [null, null]]);
    setActive([pages.length, 0]);
    loadDraft(null);
  }
  function printPages() {
    if (!canPrint) return;
    const images = Array.from(
      sheetRef.current?.querySelectorAll(".door-sheet img") || [],
    ) as HTMLImageElement[];
    if (images.some((img) => !img.complete || !img.naturalWidth)) {
      setMessage("Vent til alle produktbildene er lastet før utskrift.");
      return;
    }
    window.print();
  }
  function clearProduct() {
    setProduct(null);
    setName("");
    setDetails(doorDetails(""));
    setArgumentsText("");
    setConfirmed(false);
  }
  async function lookup(code = ean) {
    const id = ++generation.current;
    setEan(code);
    clearProduct();
    setMessage("");
    if (!validEan(code)) {
      setBusy(false);
      setMessage(
        "Skriv en gyldig EAN-8 eller EAN-13 med riktig kontrollsiffer.",
      );
      return;
    }
    setBusy(true);
    try {
      const response = await fetch("/merkelapp/api/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ean: code }),
      });
      const result = await response.json();
      if (id !== generation.current) return;
      if (!response.ok) throw new Error(result.error || "Oppslaget feilet.");
      if (result.status !== "found") {
        setMessage(
          result.message ||
            (result.status === "ambiguous"
              ? "Flere treff på EAN. Ingen variant er valgt. Kontroller koden og prøv igjen."
              : "Kunne ikke bekrefte at valgt artikkel og størrelse hos Obs BYGG samsvarer med EAN. Kontroller koden og prøv igjen."),
        );
        return;
      }
      const p: Product = result.product;
      setProduct(p);
      setName(p.name);
      setDetails(doorDetails(p.size || ""));
      setArgumentsText((p.sellingPoints || []).join("\n"));

      setMessage(
        "Kontroller mål og slagretning mot varen. Produktbildet kan være felles for flere varianter.",
      );
    } catch (error) {
      if (id === generation.current)
        setMessage(
          error instanceof Error
            ? error.message
            : "Kunne ikke hente produktet. Prøv igjen.",
        );
    } finally {
      if (id === generation.current) setBusy(false);
    }
  }
  function updateDetails(key: keyof DoorDetails, value: string) {
    setDetails((d) => ({ ...d, [key]: value }));
    setConfirmed(false);
  }
  return (
    <main className="door-workspace">
      <section className="door-controls">
        <span className="eyebrow">
          SIDE {active[0] + 1} · PLASS {active[1] + 1} AV 2
        </span>
        <h1>Dørmerking</h1>
        <p>
          Skann varen, kontroller og lagre dørmerket. Legg til en ny dør på den
          andre halvdelen, eller opprett en ny side. Hvert merke er 105 × 297 mm
          – et stående A4-ark delt på langs.
        </p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void lookup();
          }}
        >
          <label>
            EAN / strekkode
            <input
              aria-label="EAN / strekkode"
              inputMode="numeric"
              value={ean}
              maxLength={13}
              onChange={(e) => {
                generation.current++;
                setBusy(false);
                setEan(e.target.value.trim());
                clearProduct();
                setMessage("");
              }}
            />
          </label>
          <div className="door-actions">
            <button className="button primary" disabled={busy}>
              <Search size={18} />
              {busy ? "Henter …" : "Hent dør"}
            </button>
            <button
              type="button"
              className="button secondary"
              onClick={() => setScanner(true)}
            >
              <ScanLine size={18} />
              Skann
            </button>
          </div>
        </form>
        <button
          className="button secondary"
          disabled={busy}
          onClick={() => lookup("7072354000770")}
        >
          Prøv med en eksempeldør
        </button>
        <p role="status" aria-live="polite">
          {message}
        </p>
        {product && (
          <>
            <a href={product.sourceUrl} target="_blank" rel="noreferrer">
              Kontroller produktet hos Obs BYGG ↗
            </a>
            <p className="door-source">
              Valgt størrelse:{" "}
              <strong>{product.size || "Størrelse ikke oppgitt"}</strong>
            </p>
            <label>
              Produktnavn
              <input
                value={name}
                maxLength={160}
                onChange={(e) => {
                  setName(e.target.value);
                  setConfirmed(false);
                }}
              />
            </label>
            <div className="door-dimensions">
              <label>
                Bredde (cm)
                <input
                  inputMode="decimal"
                  value={details.width}
                  onChange={(e) => updateDetails("width", e.target.value)}
                />
              </label>
              <label>
                Høyde (cm)
                <input
                  inputMode="decimal"
                  value={details.height}
                  onChange={(e) => updateDetails("height", e.target.value)}
                />
              </label>
            </div>
            <label>
              Slagretning
              <select
                value={details.handing}
                onChange={(e) => updateDetails("handing", e.target.value)}
              >
                <option value="">Velg slagretning</option>
                <option value="H">H – Høyre</option>
                <option value="V">V – Venstre</option>
                <option value="Vendbar">Vendbar</option>
              </select>
            </label>
            <label>
              Salgsargumenter (ett per linje, maks. 5)
              <textarea
                rows={6}
                maxLength={904}
                value={argumentsText}
                onChange={(e) => {
                  setArgumentsText(e.target.value);
                  setConfirmed(false);
                }}
              />
            </label>
            <small>
              Maks. 180 tegn per punkt. Manglende argumenter må fylles inn fra
              produktsiden.
            </small>
            {imageState !== "ready" && (
              <p role="alert">
                {imageState === "loading"
                  ? "Laster produktbilde …"
                  : "Produktbildet mangler eller kunne ikke lastes. Prøv oppslaget på nytt før utskrift."}
              </p>
            )}
            <label className="door-check">
              <input
                type="checkbox"
                checked={confirmed}
                onChange={(e) => setConfirmed(e.target.checked)}
              />
              Jeg har kontrollert navn, mål, slagretning og salgsargumenter mot
              varen.
            </label>
          </>
        )}
        <div className="door-book-actions">
          <button
            className="button primary"
            disabled={!ready || !dirty}
            onClick={saveLabel}
          >
            <Save size={18} />
            {saved ? "Lagre endringer" : "Lagre dørmerke"}
          </button>
          <button
            className="button secondary"
            disabled={dirty || busy || pages[active[0]].every(Boolean)}
            onClick={() => selectSlot(active[0], pages[active[0]][0] ? 1 : 0)}
          >
            <Plus size={18} />
            Legg til ny
          </button>
          <button
            className="button secondary"
            disabled={
              dirty ||
              busy ||
              !pages[active[0]].some(Boolean) ||
              pages.length >= 30
            }
            onClick={addPage}
          >
            <Plus size={18} />
            Ny side
          </button>
          {dirty && (
            <button
              className="button secondary"
              onClick={() => loadDraft(saved)}
            >
              Forkast ulagrede endringer
            </button>
          )}
          {dirty && (
            <small>Lagre merket før du bytter plass eller skriver ut.</small>
          )}
        </div>
        {storageError && <p role="alert">{storageError}</p>}
        {product && !fieldsValid && (
          <p role="status">
            Fyll inn navn (maks. 160 tegn), gyldige mål, slagretning og 1–5
            salgsargumenter (maks. 180 tegn hver).
          </p>
        )}
        {!layoutFits && (
          <p role="alert">
            Teksten tar for stor plass på merket. Kort ned produktnavnet eller
            salgsargumentene før utskrift.
          </p>
        )}
        <button
          className="button primary"
          disabled={!canPrint}
          onClick={printPages}
        >
          <Printer size={18} />
          Skriv ut alle ark / lagre PDF
        </button>
        <small>
          Velg A4, stående, 100 % skala, ingen marger og slå av topp-/bunntekst.
          Lagrede merker beholdes i denne nettleseren for din bruker. Ulagrede
          endringer forsvinner når du forlater fanen.
        </small>
      </section>
      <section
        className="door-preview"
        aria-label="Forhåndsvisning"
        ref={sheetRef}
      >
        <p>
          Forhåndsvisning · {pages.length} A4-ark · to dører per side · klipp
          langs midten
        </p>
        {pages.map((page, pi) => (
          <div
            className={`door-page ${page.some(Boolean) ? "has-saved-labels" : "empty-page"}`}
            key={pi}
          >
            <div className="door-page-toolbar">
              <strong>Side {pi + 1}</strong>
              {[0, 1].map((slot) => (
                <button
                  key={slot}
                  className={`button ${active[0] === pi && active[1] === slot ? "selected" : "secondary"}`}
                  disabled={dirty || busy}
                  onClick={() => selectSlot(pi, slot)}
                >
                  {page[slot]
                    ? `Rediger dør ${slot + 1}`
                    : `+ Legg til dør ${slot + 1}`}
                </button>
              ))}
              <button
                className="button secondary"
                disabled={dirty || busy}
                onClick={() => {
                  const next = pages.filter((_, i) => i !== pi);
                  if (!next.length) next.push([null, null]);
                  storePages(next);
                  setActive([0, 0]);
                  loadDraft(next[0][0]);
                }}
              >
                Fjern side
              </button>
            </div>
            <div className="door-sheet">
              {[0, 1].map((slot) => {
                const isActive = active[0] === pi && active[1] === slot;
                const data = isActive ? currentDraft : page[slot];
                return data && (data.product || data.ean) ? (
                  <DoorLabel key={slot} {...data} onImage={onImage} />
                ) : (
                  <div className="door-empty-slot" key={slot}>
                    <span>Ledig plass {slot + 1}</span>
                    <button
                      className="button secondary"
                      disabled={dirty || busy}
                      onClick={() => selectSlot(pi, slot)}
                    >
                      <Plus size={18} />
                      Legg til ny dør
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </section>
      {scanner && (
        <Scanner
          onRead={(code) => {
            setScanner(false);
            void lookup(code);
          }}
          onClose={() => setScanner(false)}
          onManual={() => setScanner(false)}
        />
      )}
    </main>
  );
}
