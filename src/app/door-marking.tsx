"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Printer,
  ScanLine,
  Search,
  Plus,
  Pencil,
  Copy,
  Trash2,
  X,
  ChevronLeft,
  ChevronRight,
  Check,
  Undo2,
} from "lucide-react";
import { Scanner } from "./scanner";
import { Dialog } from "./dialog";
import { DoorLabel } from "./door-label";
import { DoorSheetPreview } from "./door-sheet-preview";
import { z } from "zod";
import { productSchema, validEan } from "@/lib/model";
import {
  doorDetails,
  readyToPrint,
  nextDoorSlot,
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
  const [pages, setPages] = useState<DoorPage[]>([[null, null]]);
  const [pageIndex, setPageIndex] = useState(0);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [storageError, setStorageError] = useState("");
  const [scanner, setScanner] = useState(false);
  const [editing, setEditing] = useState<[number, number] | null>(null);
  const [editor, setEditor] = useState(false);
  const [slotPicker, setSlotPicker] = useState<[number, number] | null>(null);
  const [pickerCode, setPickerCode] = useState("");
  const [product, setProduct] = useState<Product | null>(null);
  const [name, setName] = useState("");
  const [details, setDetails] = useState<DoorDetails>(doorDetails(""));
  const [argumentsText, setArgumentsText] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [draftFits, setDraftFits] = useState(true);
  const [printFits, setPrintFits] = useState(true);
  const [imageStates, setImageStates] = useState<
    Partial<Record<string, "ready" | "missing">>
  >({});
  const [removed, setRemoved] = useState<DoorPage[] | null>(null);
  const printRoot = useRef<HTMLDivElement>(null);
  const draftRoot = useRef<HTMLDivElement>(null);
  const generation = useRef(0);
  const storageKey = `merkelapp-doors-v1-${accountId}`;
  useEffect(() => {
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const restored = bookSchema.safeParse(JSON.parse(stored));
        if (restored.success) {
          setPages(restored.data as DoorPage[]);
        } else
          setStorageError(
            "Tidligere ark kunne ikke leses. Legg til dørene på nytt.",
          );
      }
    } catch {
      setStorageError(
        "Lokal lagring er utilgjengelig. Behold fanen åpen til du har skrevet ut.",
      );
    }
  }, [storageKey]);
  useEffect(
    () => () => {
      generation.current++;
    },
    [],
  );
  const onImage = useCallback((url: string, state: "ready" | "missing") => {
    setImageStates((previous) =>
      previous[url] === state ? previous : { ...previous, [url]: state },
    );
  }, []);
  const points = argumentsText
    .split("\n")
    .map((p) => p.trim())
    .filter(Boolean);
  const target = editing || nextDoorSlot(pages);
  const replacing = !!editing && !!pages[editing[0]]?.[editing[1]];
  const draft = product
    ? { ean: product.ean, name, details, points, product }
    : null;
  const fieldsValid = !!draft && readyToPrint(draft.ean, name, details, points);
  const ready =
    fieldsValid &&
    draftFits &&
    confirmed &&
    !!target &&
    imageStates[product!.imageUrl!] === "ready";
  const savedLabels = pages.flat().filter((d): d is DoorLabelData => !!d);
  const pageCount = pages.length;
  const printPageCount = pages.filter((p) => p.some(Boolean)).length;
  const canPrint =
    !!savedLabels.length &&
    !editor &&
    !slotPicker &&
    !busy &&
    printFits &&
    savedLabels.every((d) => imageStates[d.product.imageUrl!] === "ready");
  const selectedPage = pages[pageIndex] || pages[0];
  useEffect(() => {
    const fits = (root: HTMLElement | null) =>
      Array.from(root?.querySelectorAll(".door-label") || []).every(
        (el) => el.scrollHeight <= el.clientHeight + 1,
      );
    const measure = () => {
      setDraftFits(fits(draftRoot.current));
      setPrintFits(fits(printRoot.current));
    };
    const observer = new ResizeObserver(measure);
    [draftRoot.current, printRoot.current].forEach((root) =>
      root
        ?.querySelectorAll(".door-label, .door-label > *")
        .forEach((el) => observer.observe(el)),
    );
    measure();
    return () => observer.disconnect();
  }, [editor, name, argumentsText, details, pages, imageStates]);
  function storePages(next: DoorPage[]) {
    setPages(next);
    try {
      localStorage.setItem(storageKey, JSON.stringify(next));
      setStorageError("");
    } catch {
      setStorageError(
        "Kunne ikke lagre på enheten. Skriv ut før du lukker fanen.",
      );
    }
  }
  function closeEditor() {
    setEditor(false);
    setProduct(null);
    setEditing(null);
  }
  function openEditor(
    data: DoorLabelData,
    position: [number, number] | null,
    checked = !!position,
  ) {
    setProduct(data.product);
    setName(data.name);
    setDetails({ ...data.details });
    setArgumentsText(data.points.join("\n"));
    setConfirmed(checked);
    setEditing(position);
    setEditor(true);
  }
  function chooseHalf(slot: number) {
    if (busy) return;
    const data = selectedPage[slot];
    if (data) openEditor(data, [pageIndex, slot]);
    else {
      setPickerCode("");
      setMessage("");
      setSlotPicker([pageIndex, slot]);
    }
  }
  function closePicker() {
    generation.current++;
    setBusy(false);
    setSlotPicker(null);
    setMessage("");
  }
  function changeDoor() {
    if (!editing) return;
    setSlotPicker(editing);
    setPickerCode("");
    setMessage("");
    setEditor(false);
    setProduct(null);
    setEditing(null);
  }
  async function lookup(ean: string, position: [number, number] | null = null) {
    if (!position && !nextDoorSlot(pages)) {
      setMessage(
        "Du har nå 30 fulle ark. Fjern en dør før du legger til flere.",
      );
      return;
    }
    const id = ++generation.current;
    setMessage("");
    if (!validEan(ean)) {
      setMessage("Skriv en gyldig EAN-8 eller EAN-13.");
      return;
    }
    setBusy(true);
    try {
      const response = await fetch("/merkelapp/api/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ean }),
      });
      const result = await response.json();
      if (id !== generation.current) return;
      if (!response.ok) throw new Error(result.error || "Oppslaget feilet.");
      if (result.status !== "found")
        throw new Error(
          result.message ||
            "Kunne ikke bekrefte valgt artikkel og størrelse mot EAN. Kontroller koden og prøv igjen.",
        );
      const p: Product = result.product;
      openEditor(
        {
          ean: p.ean,
          name: p.name,
          details: doorDetails(p.size || ""),
          points: p.sellingPoints || [],
          product: p,
        },
        position,
        false,
      );
      setSlotPicker(null);
    } catch (error) {
      if (id === generation.current)
        setMessage(
          error instanceof Error
            ? error.message
            : "Oppslaget feilet. Prøv igjen.",
        );
    } finally {
      if (id === generation.current) setBusy(false);
    }
  }
  function placeDoor() {
    if (!ready || !draft || !target) return;
    const next = pages.map((p) => [...p] as DoorPage);
    if (!next[target[0]]) next.push([null, null]);
    next[target[0]][target[1]] = draft;
    storePages(next);
    setPageIndex(target[0]);
    setRemoved(null);
    setMessage(
      replacing
        ? "Dørmerket er oppdatert."
        : next[target[0]].every(Boolean)
          ? `Ark ${target[0] + 1} er fullt. Skann neste dør for å fortsette.`
          : "Døren er lagt på arket. Skann neste dør for å fylle den andre halvdelen.",
    );
    closeEditor();
  }
  function duplicate(data: DoorLabelData) {
    const slot = nextDoorSlot(pages);
    if (!slot) return;
    const next = pages.map((p) => [...p] as DoorPage);
    if (!next[slot[0]]) next.push([null, null]);
    next[slot[0]][slot[1]] = structuredClone(data);
    storePages(next);
    setPageIndex(slot[0]);
    setRemoved(null);
    setMessage("En kopi er lagt på arket.");
  }
  function removeDoor(slot: number) {
    setRemoved(pages);
    const next = pages.map((p) => [...p] as DoorPage);
    next[pageIndex][slot] = null;
    const filled = next.filter((p) => p.some(Boolean));
    storePages(filled.length ? filled : [[null, null]]);
    setPageIndex(Math.min(pageIndex, Math.max(0, filled.length - 1)));
    setMessage("Dørmerket er fjernet.");
  }
  function printPages() {
    if (!canPrint) return;
    const images = Array.from(printRoot.current?.querySelectorAll("img") || []);
    if (images.some((img) => !img.complete || !img.naturalWidth)) {
      setMessage("Vent til alle bildene er lastet.");
      return;
    }
    window.print();
  }
  const changeDetails = (key: keyof DoorDetails, value: string) => {
    setDetails((d) => ({ ...d, [key]: value }));
    setConfirmed(false);
  };
  return (
    <main className="door-workspace">
      <header className="door-heading">
        <div>
          <h1>Dørmerking</h1>
          <p>Trykk på den halvdelen av arket du vil fylle eller endre.</p>
        </div>
        <button
          className="button primary"
          disabled={!canPrint}
          onClick={printPages}
        >
          <Printer size={18} />
          Skriv ut
          {savedLabels.length ? ` · ${printPageCount} ark` : ""}
        </button>
      </header>
      <section className="door-canvas-actions" aria-label="Arkverktøy">
        <button
          className="button secondary"
          disabled={busy || pages.length >= 30}
          onClick={() => {
            if (!pages[pages.length - 1].some(Boolean)) {
              setPageIndex(pages.length - 1);
              return;
            }
            storePages([...pages, [null, null]]);
            setPageIndex(pages.length);
            setMessage("");
          }}
        >
          <Plus size={18} />
          Nytt ark
        </button>
        <button
          className="button secondary"
          disabled={busy}
          onClick={() => setScanner(true)}
        >
          <ScanLine size={18} />
          Skann neste dør
        </button>
        <small>
          <Check size={14} />
          Lagres automatisk
        </small>
      </section>
      <section className="door-canvas-messages">
        {message && (
          <p className="door-notice" role="status">
            {message}
          </p>
        )}
        {removed && (
          <button
            className="button secondary"
            onClick={() => {
              storePages(removed);
              setRemoved(null);
              setMessage("Dørmerket er gjenopprettet.");
            }}
          >
            <Undo2 size={16} />
            Angre fjerning
          </button>
        )}
        {storageError && (
          <p className="door-notice" role="alert">
            {storageError}
          </p>
        )}
        {!printFits && (
          <p role="alert">
            Et merke har for mye tekst. Rediger og kort ned teksten før
            utskrift.
          </p>
        )}
        {savedLabels.some(
          (d) => imageStates[d.product.imageUrl!] === "missing",
        ) && (
          <p role="alert">
            Et produktbilde kunne ikke lastes. Last siden på nytt før utskrift.
          </p>
        )}
      </section>
      <section className="door-preview" aria-label="Forhåndsvisning av A4">
        <div className="door-preview-toolbar">
          <div>
            <strong>
              Ark {pageIndex + 1} av {pageCount}
            </strong>
            <span>A4 stående · klipp langs midten</span>
          </div>
          <div className="door-page-navigation">
            <button
              className="icon-button"
              aria-label="Forrige ark"
              disabled={pageIndex === 0}
              onClick={() => setPageIndex((p) => p - 1)}
            >
              <ChevronLeft size={20} />
            </button>
            <button
              className="icon-button"
              aria-label="Neste ark"
              disabled={pageIndex >= pages.length - 1}
              onClick={() => setPageIndex((p) => p + 1)}
            >
              <ChevronRight size={20} />
            </button>
          </div>
        </div>
        <DoorSheetPreview>
          {selectedPage.map((data, slot) => (
            <div className="door-clickable-half" key={slot}>
              {data ? (
                <DoorLabel {...data} onImage={onImage} />
              ) : (
                <div className="door-empty-slot">
                  <svg
                    className="door-example-drawing"
                    viewBox="0 0 120 230"
                    aria-hidden="true"
                  >
                    <rect
                      x="12"
                      y="8"
                      width="96"
                      height="214"
                      rx="2"
                      fill="#eef3fb"
                      stroke="#b9cbe3"
                      strokeWidth="3"
                    />
                    <rect
                      x="22"
                      y="20"
                      width="76"
                      height="86"
                      rx="2"
                      fill="white"
                      stroke="#cbd8e9"
                      strokeWidth="2"
                    />
                    <rect
                      x="22"
                      y="120"
                      width="76"
                      height="88"
                      rx="2"
                      fill="white"
                      stroke="#cbd8e9"
                      strokeWidth="2"
                    />
                    <path
                      d="M28 113h15"
                      stroke="#9cb3d2"
                      strokeWidth="5"
                      strokeLinecap="round"
                    />
                  </svg>
                  <strong>
                    {slot === 0 ? "Venstre halvdel" : "Høyre halvdel"}
                  </strong>
                  <span>Trykk her for å legge til en dør</span>
                </div>
              )}
              <button
                className="door-half-button"
                disabled={busy}
                aria-label={`${data ? "Endre" : "Legg til dør på"} ${slot === 0 ? "venstre" : "høyre"} halvdel på ark ${pageIndex + 1}`}
                onClick={() => chooseHalf(slot)}
              >
                <span>
                  {data ? <Pencil size={24} /> : <Plus size={24} />}
                  {data ? "Trykk for å endre" : "Legg til dør"}
                </span>
              </button>
            </div>
          ))}
        </DoorSheetPreview>
        {pages.length > 1 && (
          <nav className="door-page-tabs" aria-label="Velg ark">
            {pages.map((_, i) => (
              <button
                key={i}
                className={`button ${i === pageIndex ? "selected" : "secondary"}`}
                aria-current={i === pageIndex ? "page" : undefined}
                onClick={() => setPageIndex(i)}
              >
                Ark {i + 1}
              </button>
            ))}
          </nav>
        )}
        <p className="door-preview-hint">
          Trykk på venstre eller høyre halvdel for å legge til, bytte eller
          redigere en dør.
        </p>
      </section>
      <div className="door-print-root" ref={printRoot} aria-hidden="true">
        {pages
          .filter((p) => p.some(Boolean))
          .map((page, i) => (
            <div className="door-sheet" key={i}>
              {page.map((data, slot) =>
                data ? (
                  <DoorLabel key={slot} {...data} onImage={onImage} />
                ) : (
                  <div className="door-empty-slot" key={slot} />
                ),
              )}
            </div>
          ))}
      </div>
      {slotPicker && (
        <Dialog labelledBy="door-picker-title" onClose={closePicker}>
          <section className="door-editor door-controls">
            <div className="door-editor-heading">
              <div>
                <span className="eyebrow">
                  ARK {slotPicker[0] + 1} ·{" "}
                  {slotPicker[1] === 0 ? "VENSTRE" : "HØYRE"} HALVDEL
                </span>
                <h2 id="door-picker-title">
                  {pages[slotPicker[0]][slotPicker[1]]
                    ? "Bytt dør på denne halvdelen"
                    : "Legg til dør her"}
                </h2>
              </div>
              <button
                className="icon-button"
                aria-label="Lukk valg av dør"
                onClick={closePicker}
              >
                <X size={20} />
              </button>
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void lookup(pickerCode, slotPicker);
              }}
            >
              <label>
                EAN for denne halvdelen
                <input
                  autoFocus
                  aria-label="EAN for denne halvdelen"
                  inputMode="numeric"
                  maxLength={13}
                  value={pickerCode}
                  placeholder="Skann eller skriv EAN"
                  onChange={(e) => {
                    generation.current++;
                    setBusy(false);
                    setPickerCode(e.target.value.trim());
                    setMessage("");
                  }}
                />
              </label>
              <div className="door-actions">
                <button
                  className="button primary"
                  disabled={busy || !pickerCode}
                >
                  <Search size={18} />
                  {busy ? "Henter …" : "Hent dør"}
                </button>
                <button
                  type="button"
                  className="button secondary"
                  disabled={busy}
                  onClick={() => setScanner(true)}
                >
                  <ScanLine size={18} />
                  Kamera
                </button>
              </div>
            </form>
            {pages[slotPicker[0]][slotPicker[1]] && (
              <small>
                Den eksisterende døren beholdes til du lagrer den nye.
              </small>
            )}
            {message && <p role="status">{message}</p>}
            <button className="button secondary" onClick={closePicker}>
              Avbryt
            </button>
          </section>
        </Dialog>
      )}
      {editor && product && (
        <Dialog labelledBy="door-editor-title" onClose={closeEditor}>
          <section className="door-editor door-controls">
            <div className="door-editor-heading">
              <div>
                <span className="eyebrow">
                  {replacing ? "REDIGER DØR" : "KONTROLLER DØREN"}
                </span>
                <h2 id="door-editor-title">
                  {replacing ? "Endre dørmerket" : "Klar til å legge på arket?"}
                </h2>
              </div>
              <button
                className="icon-button"
                aria-label="Lukk redigering"
                onClick={closeEditor}
              >
                <X size={20} />
              </button>
            </div>
            <div className="door-selected-product">
              <img
                src={product.imageUrl}
                alt=""
                referrerPolicy="no-referrer"
                onLoad={() => onImage(product.imageUrl!, "ready")}
                onError={() => onImage(product.imageUrl!, "missing")}
              />
              <div>
                <strong>{name}</strong>
                <span>
                  Valgt størrelse: <b>{product.size || "Ikke oppgitt"}</b>
                </span>
                <span>Artikkelnummer: {product.ean} · EAN kontrollert</span>
                <a href={product.sourceUrl} target="_blank" rel="noreferrer">
                  Se valgt variant hos Obs BYGG ↗
                </a>
              </div>
            </div>
            {editing && (
              <button
                className="button secondary door-change-product"
                onClick={changeDoor}
              >
                <ScanLine size={18} />
                Bytt til en annen dør
              </button>
            )}
            {replacing && editing && (
              <div className="door-editor-item-actions">
                <button
                  className="button secondary"
                  disabled={!nextDoorSlot(pages)}
                  onClick={() => {
                    const saved = pages[editing[0]][editing[1]];
                    if (saved) {
                      duplicate(saved);
                      closeEditor();
                    }
                  }}
                >
                  <Copy size={16} />
                  Kopier til ledig plass
                </button>
                <button
                  className="button secondary"
                  onClick={() => {
                    removeDoor(editing[1]);
                    closeEditor();
                  }}
                >
                  <Trash2 size={16} />
                  Fjern fra arket
                </button>
              </div>
            )}
            <div className="door-editor-specs">
              <label>
                Bredde (cm)
                <input
                  inputMode="decimal"
                  value={details.width}
                  onChange={(e) => changeDetails("width", e.target.value)}
                />
              </label>
              <label>
                Høyde (cm)
                <input
                  inputMode="decimal"
                  value={details.height}
                  onChange={(e) => changeDetails("height", e.target.value)}
                />
              </label>
              <label>
                Slagretning
                <select
                  value={details.handing}
                  onChange={(e) => changeDetails("handing", e.target.value)}
                >
                  <option value="">Velg …</option>
                  <option value="H">H – Høyre</option>
                  <option value="V">V – Venstre</option>
                  <option value="Vendbar">Vendbar</option>
                </select>
              </label>
            </div>
            <details
              className="door-extra-fields"
              open={!points.length || name.length > 160}
            >
              <summary>Endre navn og salgsargumenter</summary>
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
              <label>
                Salgsargumenter (ett per linje, maks. 5)
                <textarea
                  rows={5}
                  maxLength={904}
                  value={argumentsText}
                  onChange={(e) => {
                    setArgumentsText(e.target.value);
                    setConfirmed(false);
                  }}
                />
              </label>
              <small>Maks. 180 tegn per punkt.</small>
            </details>
            <label className="door-check">
              <input
                type="checkbox"
                checked={confirmed}
                onChange={(e) => setConfirmed(e.target.checked)}
              />
              Jeg har kontrollert mål, slagretning og produktopplysninger.
            </label>
            <small>
              Bildet er en illustrasjon og kan være felles for høyre- og
              venstrehengslede dører.
            </small>
            {!fieldsValid && (
              <p role="status">
                Fyll inn mål, slagretning, navn og 1–5 korte salgsargumenter.
              </p>
            )}
            {!draftFits && (
              <p role="alert">
                Teksten er for lang for merket. Kort ned navn eller
                salgsargumenter.
              </p>
            )}
            {imageStates[product.imageUrl!] !== "ready" && (
              <p role="status">
                {!product.imageUrl ||
                imageStates[product.imageUrl] === "missing"
                  ? "Produktbildet kunne ikke lastes. Prøv oppslaget på nytt."
                  : "Laster bilde …"}
              </p>
            )}
            <div className="door-editor-footer">
              <span>
                {target &&
                  `Ark ${target[0] + 1} · ${target[1] === 0 ? "venstre" : "høyre"} halvdel`}
              </span>
              <button className="button secondary" onClick={closeEditor}>
                Avbryt
              </button>
              <button
                className="button primary"
                disabled={!ready}
                onClick={placeDoor}
              >
                <Check size={18} />
                {replacing ? "Lagre endringer" : "Legg på arket"}
              </button>
            </div>
          </section>
        </Dialog>
      )}
      {editor && draft && (
        <div className="door-draft-measure" ref={draftRoot} aria-hidden="true">
          <DoorLabel {...draft} onImage={onImage} />
        </div>
      )}
      {scanner && (
        <Scanner
          onRead={(ean) => {
            setScanner(false);
            void lookup(ean, slotPicker);
          }}
          onClose={() => setScanner(false)}
          onManual={() => {
            setScanner(false);
            if (!slotPicker) {
              const slot = nextDoorSlot(pages);
              if (slot) {
                if (slot[0] === pages.length)
                  storePages([...pages, [null, null]]);
                setPageIndex(slot[0]);
                setPickerCode("");
                setSlotPicker(slot);
              }
            }
          }}
        />
      )}
    </main>
  );
}
