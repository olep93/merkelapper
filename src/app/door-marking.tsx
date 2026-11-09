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
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [storageError, setStorageError] = useState("");
  const [scanner, setScanner] = useState(false);
  const [editing, setEditing] = useState<[number, number] | null>(null);
  const [editor, setEditor] = useState(false);
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
  const eanInput = useRef<HTMLInputElement>(null);
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
          const filled = restored.data.filter((p) =>
            p.some(Boolean),
          ) as DoorPage[];
          setPages(filled.length ? filled : [[null, null]]);
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
  const pageCount = Math.max(1, pages.filter((p) => p.some(Boolean)).length);
  const canPrint =
    !!savedLabels.length &&
    !editor &&
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
    setTimeout(() => eanInput.current?.focus(), 0);
  }
  function openEditor(data: DoorLabelData, position: [number, number] | null) {
    setProduct(data.product);
    setName(data.name);
    setDetails({ ...data.details });
    setArgumentsText(data.points.join("\n"));
    setConfirmed(!!position);
    setEditing(position);
    setEditor(true);
  }
  async function lookup(ean = code) {
    if (!nextDoorSlot(pages)) {
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
        null,
      );
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
    setCode("");
    setMessage(
      editing
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
          <p>To dører på hvert A4-ark. Neste ark opprettes automatisk.</p>
        </div>
        <button
          className="button primary"
          disabled={!canPrint}
          onClick={printPages}
        >
          <Printer size={18} />
          Skriv ut
          {savedLabels.length ? ` · ${pageCount} ark` : ""}
        </button>
      </header>
      <aside className="door-sidebar">
        <section className="door-controls door-add">
          <h2>Legg til dør</h2>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void lookup();
            }}
          >
            <label>
              EAN / strekkode
              <input
                ref={eanInput}
                aria-label="EAN / strekkode"
                inputMode="numeric"
                maxLength={13}
                value={code}
                placeholder="Skann eller skriv EAN"
                onChange={(e) => {
                  generation.current++;
                  setBusy(false);
                  setCode(e.target.value.trim());
                  setMessage("");
                }}
              />
            </label>
            <div className="door-actions">
              <button className="button primary" disabled={busy || !code}>
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
          <small>
            {nextDoorSlot(pages)
              ? `Neste dør → ark ${nextDoorSlot(pages)![0] + 1}, ${nextDoorSlot(pages)![1] === 0 ? "venstre" : "høyre"} halvdel`
              : "Alle 30 ark er fulle."}
          </small>
          {!savedLabels.length && (
            <button
              className="door-example"
              disabled={busy}
              onClick={() => lookup("7072354000770")}
            >
              Prøv med en eksempeldør
            </button>
          )}
        </section>
        <section
          className="door-card-list"
          aria-label={`Dører på ark ${pageIndex + 1}`}
        >
          <h2>På ark {pageIndex + 1}</h2>
          {selectedPage.map((data, slot) =>
            data ? (
              <article className="door-item" key={slot}>
                <span className="door-slot-caption">
                  {slot === 0 ? "VENSTRE" : "HØYRE"} HALVDEL
                </span>
                <div className="door-item-info">
                  <img
                    src={data.product.imageUrl}
                    alt=""
                    referrerPolicy="no-referrer"
                  />
                  <div>
                    <strong>{data.name}</strong>
                    <span>
                      {data.details.width} × {data.details.height} cm ·{" "}
                      {data.details.handing}
                    </span>
                  </div>
                </div>
                <div className="door-item-actions">
                  <button
                    className="button secondary"
                    onClick={() => openEditor(data, [pageIndex, slot])}
                  >
                    <Pencil size={15} />
                    Rediger
                  </button>
                  <button
                    className="icon-button"
                    aria-label={`Kopier dør ${slot + 1}`}
                    title="Kopier dør"
                    disabled={!nextDoorSlot(pages)}
                    onClick={() => duplicate(data)}
                  >
                    <Copy size={17} />
                  </button>
                  <button
                    className="icon-button"
                    aria-label={`Fjern dør ${slot + 1}`}
                    title="Fjern dør"
                    onClick={() => removeDoor(slot)}
                  >
                    <Trash2 size={17} />
                  </button>
                </div>
              </article>
            ) : (
              <button
                key={slot}
                className="door-empty-card"
                onClick={() => eanInput.current?.focus()}
              >
                <Plus size={20} />
                <span>
                  {slot === 0 ? "Første dør" : "Plass til én dør til"}
                  <small>Skann eller skriv EAN ovenfor</small>
                </span>
              </button>
            ),
          )}
        </section>
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
        <small className="door-storage-note">
          <Check size={14} />
          Arkene lagres automatisk i denne nettleseren.
        </small>
      </aside>
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
          {selectedPage.map((data, slot) =>
            data ? (
              <DoorLabel key={slot} {...data} onImage={onImage} />
            ) : (
              <div className="door-empty-slot" key={slot}>
                <Plus size={44} />
                <strong>{slot === 0 ? "Din første dør" : "Neste dør"}</strong>
                <span>Skann en dør for å fylle denne halvdelen</span>
              </div>
            ),
          )}
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
          Hele arket vises tilpasset skjermen. Utskrift beholder riktig
          størrelse.
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
      {editor && product && (
        <Dialog labelledBy="door-editor-title" onClose={closeEditor}>
          <section className="door-editor door-controls">
            <div className="door-editor-heading">
              <div>
                <span className="eyebrow">
                  {editing ? "REDIGER DØR" : "KONTROLLER DØREN"}
                </span>
                <h2 id="door-editor-title">
                  {editing ? "Endre dørmerket" : "Klar til å legge på arket?"}
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
                {editing ? "Lagre endringer" : "Legg på arket"}
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
            setCode(ean);
            void lookup(ean);
          }}
          onClose={() => setScanner(false)}
          onManual={() => {
            setScanner(false);
            eanInput.current?.focus();
          }}
        />
      )}
    </main>
  );
}
