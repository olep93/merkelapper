"use client";
import { useEffect, useRef, useState } from "react";
import { Printer, ScanLine, Search } from "lucide-react";
import { Scanner } from "./scanner";
import { eanBits } from "@/lib/barcode";
import { validEan } from "@/lib/model";
import {
  doorDetails,
  readyToPrint,
  type DoorDetails,
} from "@/lib/door-marking";
import type { Product } from "@/lib/products";
import "./door-marking.css";

export function DoorMarking() {
  const [ean, setEan] = useState("");
  const [product, setProduct] = useState<Product | null>(null);
  const [name, setName] = useState("");
  const [details, setDetails] = useState<DoorDetails>(doorDetails(""));
  const [argumentsText, setArgumentsText] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [scanner, setScanner] = useState(false);
  const [copies, setCopies] = useState(2);
  const [confirmed, setConfirmed] = useState(false);
  const [imageState, setImageState] = useState<"loading" | "ready" | "missing">(
    "missing",
  );
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
        Array.from(sheetRef.current?.children || []).every(
          (label) => label.scrollHeight <= label.clientHeight + 1,
        ),
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
  }, [name, argumentsText, details, copies, imageState]);
  function clearProduct() {
    setProduct(null);
    setName("");
    setDetails(doorDetails(""));
    setArgumentsText("");
    setConfirmed(false);
    setImageState("missing");
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
              : "Fant ikke et sikkert treff hos Obs BYGG. Kontroller EAN og prøv igjen."),
        );
        return;
      }
      const p: Product = result.product;
      setProduct(p);
      setName(p.name);
      setDetails(doorDetails(p.size || ""));
      setArgumentsText((p.sellingPoints || []).join("\n"));
      setImageState(p.imageUrl ? "loading" : "missing");
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
  const label = (copy: number) => (
    <article
      className="door-label"
      key={copy}
      aria-label={`Dørmerke ${copy + 1}`}
    >
      <div className="door-label-kicker">DØRMERKING</div>
      <h2>{name || "Produktnavn"}</h2>
      <div className="door-image">
        {product?.imageUrl ? (
          <img
            key={product.imageUrl}
            src={product.imageUrl}
            alt={name}
            referrerPolicy="no-referrer"
            onLoad={() => setImageState("ready")}
            onError={() => setImageState("missing")}
          />
        ) : (
          <span>Skann en dør for å hente bilde</span>
        )}
      </div>
      <small className="door-image-note">
        Illustrasjonsbilde – se slagretning nedenfor
      </small>
      <div className="door-specs">
        <div>
          <small>SLAGRETNING</small>
          <strong>
            {details.handing === "H"
              ? "H · Høyre"
              : details.handing === "V"
                ? "V · Venstre"
                : details.handing || "Må fylles inn"}
          </strong>
        </div>
        <div>
          <small>BREDDE × HØYDE</small>
          <strong>
            {details.width || "–"} × {details.height || "–"} cm
          </strong>
          <small>Oppgitt størrelse / modulmål</small>
        </div>
      </div>
      <ul className="door-arguments">
        {points.map((p, i) => (
          <li key={i}>{p}</li>
        ))}
      </ul>
      <div className="door-barcode">
        {validEan(ean) && (
          <svg
            role="img"
            aria-label={`Strekkode ${ean}`}
            viewBox={`0 0 ${eanBits(ean).length + 22} 80`}
            width={`${(eanBits(ean).length + 22) * 0.33}mm`}
            height="26.4mm"
          >
            <rect width="100%" height="100%" fill="white" />
            {[...eanBits(ean)].map((b, i) =>
              b === "1" ? (
                <rect
                  key={i}
                  x={i + 11}
                  y={0}
                  width={1}
                  height={70}
                  fill="black"
                />
              ) : null,
            )}
          </svg>
        )}
        <strong>{ean || "EAN"}</strong>
      </div>
      <footer>Produktinformasjon fra Obs BYGG</footer>
    </article>
  );
  return (
    <main className="door-workspace">
      <section className="door-controls">
        <span className="eyebrow">NYTT DØRMERKE</span>
        <h1>Dørmerking</h1>
        <p>
          Skann varen, kontroller opplysningene og skriv ut. Hvert merke er 105
          × 297 mm – et stående A4-ark delt på langs.
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
              Variant fra nettsiden:{" "}
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
        <label>
          Merker på A4-arket
          <select
            value={copies}
            onChange={(e) => setCopies(Number(e.target.value))}
          >
            <option value={1}>1 merke</option>
            <option value={2}>2 like merker</option>
          </select>
        </label>
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
          disabled={!ready}
          onClick={() => window.print()}
        >
          <Printer size={18} />
          Skriv ut / lagre PDF
        </button>
        <small>
          Velg A4, stående, 100 % skala, ingen marger og slå av topp-/bunntekst.
          Utkastet beholdes bare mens denne fanen er åpen.
        </small>
      </section>
      <section className="door-preview" aria-label="Forhåndsvisning">
        <p>Forhåndsvisning · A4 · klipp langs midten</p>
        <div className="door-sheet" ref={sheetRef}>
          {Array.from({ length: copies }, (_, i) => label(i))}
        </div>
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
