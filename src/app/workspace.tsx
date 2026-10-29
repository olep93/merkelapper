"use client";
import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronRight,
  FileText,
  FolderOpen,
  Hash,
  LoaderCircle,
  LockKeyhole,
  Plus,
  Printer,
  RefreshCw,
  ScanLine,
  Search,
  Tag,
  Trash2,
  Undo2,
  X,
  Cloud,
  WifiOff,
  Pencil,
  CalendarDays,
} from "lucide-react";
import {
  dateLabel,
  emptyBody,
  validEan,
  osloDate,
  type Sheet,
  type SheetBody,
  type Line,
} from "@/lib/model";
import { Scanner } from "./scanner";
import { ProductPhoto } from "./product-photo";
import type { Product } from "@/lib/products";
const API = "/merkelapp/api";
type Layout = {
  pages: {
    nameWidth: number;
    quantityWidth: number;
    barcodeWidth: number;
    count: number;
    fontSize: number;
    lines: {
      id: string;
      nameLines: string[];
      nameSize: number;
      eanSize: number;
      quantitySize: number;
      height: number;
      stacked: boolean;
      imageSize: number;
      imageGap: number;
    }[];
  }[];
};
class RequestError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}
async function api(path: string, options?: RequestInit) {
  let response: Response | undefined;
  for (let attempt = 0; attempt < 2; attempt++)
    try {
      response = await fetch(API + path, {
        cache: "no-store",
        ...options,
        headers: { "Content-Type": "application/json", ...options?.headers },
      });
      break;
    } catch {
      if (attempt === 1)
        throw new RequestError(
          "Venter på nett. Endringene er ikke bekreftet lagret. Prøv igjen når du er på nett.",
          0,
        );
    }
  const data = await response!.json();
  if (!response!.ok)
    throw new RequestError(data.error || "Noe gikk galt.", response!.status);
  return data;
}
export function Workspace() {
  const [account, setAccount] = useState<{
      name: string;
      email: string;
    } | null>(null),
    [loading, setLoading] = useState(true),
    [gate, setGate] = useState("");
  const [sheets, setSheets] = useState<Sheet[]>([]),
    [sheet, setSheet] = useState<Sheet | null>(null),
    [draft, setDraft] = useState<SheetBody>(emptyBody),
    [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [conflict, setConflict] = useState(false),
    [scanner, setScanner] = useState(false),
    [preview, setPreview] = useState(false),
    [layout, setLayout] = useState<Layout | null>(null),
    [layoutError, setLayoutError] = useState("");
  const [form, setForm] = useState(false),
    [ean, setEan] = useState(""),
    [name, setName] = useState(""),
    [qty, setQty] = useState(""),
    [editId, setEditId] = useState<string | null>(null),
    [duplicate, setDuplicate] = useState<Line | null>(null),
    [formError, setFormError] = useState(""),
    [removed, setRemoved] = useState<{ line: Line; index: number } | null>(
      null,
    );
  const [product, setProduct] = useState<Product | null>(null),
    [lookupState, setLookupState] = useState<
      "idle" | "loading" | "found" | "not_found" | "unavailable" | "ambiguous"
    >("idle"),
    [lookupMessage, setLookupMessage] = useState(""),
    [lookupRetry, setLookupRetry] = useState(0),
    [productChoices, setProductChoices] = useState<Product[]>([]);
  const nameTouched = useRef(false);
  const [pdfState, setPdfState] = useState(""),
    [filter, setFilter] = useState<"all" | "draft" | "locked" | "trash">("all");
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState("");
  const syncingRef = useRef(false);
  const interactionRef = useRef({ busy, form, scanner });
  interactionRef.current = { busy, form, scanner };
  const pdfWindowRef = useRef<Window | null>(null);
  const current = useRef<Sheet | null>(null),
    bodyRef = useRef(draft),
    working = useRef(false),
    saved = useRef(""),
    nameInput = useRef<HTMLInputElement>(null),
    quantityInput = useRef<HTMLInputElement>(null);
  bodyRef.current = draft;
  function accept(s: Sheet) {
    current.current = s;
    setSheet(s);
    setSheets((list) => [s, ...list.filter((x) => x.id !== s.id)]);
  }
  async function refresh() {
    const list = await api("/sheets?include_deleted=1");
    setSheets(list);
  }
  useEffect(() => {
    (async () => {
      try {
        setAccount(await api("/session"));
        await refresh();
      } catch (e) {
        setGate(e instanceof Error ? e.message : "Kunne ikke laste inn.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);
  async function syncSheets() {
    if (syncingRef.current || working.current || interactionRef.current.busy)
      return;
    const selected = current.current;
    syncingRef.current = true;
    setSyncing(true);
    try {
      const list: Sheet[] = await api("/sheets?include_deleted=1");
      // A save or sheet switch during the request takes precedence over this snapshot.
      if (
        working.current ||
        interactionRef.current.busy ||
        current.current?.id !== selected?.id ||
        current.current?.version !== selected?.version
      )
        return;
      setSheets(list);
      setSyncError("");
      const editing =
        interactionRef.current.form ||
        interactionRef.current.scanner ||
        (selected && JSON.stringify(bodyRef.current) !== saved.current);
      if (!selected || editing) return;
      const latest = list.find((s) => s.id === selected.id);
      if (!latest) {
        current.current = null;
        saved.current = "";
        setSheet(null);
        setDraft(emptyBody());
        setPreview(false);
        setPdfState("");
      } else if (latest.version !== selected.version) {
        accept(latest);
        saved.current = JSON.stringify(latest.body);
        setDraft(latest.body);
        setRemoved(null);
        setConflict(false);
        setError("");
        setPdfState("");
      }
    } catch {
      setSyncError("Kunne ikke oppdatere. Prøver igjen automatisk.");
    } finally {
      syncingRef.current = false;
      setSyncing(false);
    }
  }
  useEffect(() => {
    if (loading || gate) return;
    const syncVisible = () => {
      if (document.visibilityState === "visible") void syncSheets();
    };
    const timer = setInterval(syncVisible, 5000);
    document.addEventListener("visibilitychange", syncVisible);
    window.addEventListener("focus", syncVisible);
    window.addEventListener("online", syncVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", syncVisible);
      window.removeEventListener("focus", syncVisible);
      window.removeEventListener("online", syncVisible);
    };
  }, [loading, gate]);
  const dirty = Boolean(sheet) && JSON.stringify(draft) !== saved.current;
  useEffect(() => {
    const fn = (e: BeforeUnloadEvent) => {
      if (
        JSON.stringify(bodyRef.current) !== saved.current &&
        current.current
      ) {
        e.preventDefault();
      }
    };
    window.addEventListener("beforeunload", fn);
    return () => window.removeEventListener("beforeunload", fn);
  }, []);
  async function persist(body: SheetBody) {
    if (
      working.current ||
      !current.current ||
      current.current.state !== "draft" ||
      Boolean(current.current.deleted_at)
    )
      return false;
    const encoded = JSON.stringify(body);
    if (encoded === saved.current) return true;
    working.current = true;
    setBusy(true);
    setError("");
    try {
      const s = await api(`/sheets/${current.current.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          action: "save",
          version: current.current.version,
          operation: crypto.randomUUID(),
          body,
        }),
      });
      accept(s);
      saved.current = encoded;
      setConflict(false);
      return true;
    } catch (e) {
      setError((e as Error).message);
      if (e instanceof RequestError && e.status === 409) setConflict(true);
      return false;
    } finally {
      working.current = false;
      setBusy(false);
    }
  }
  useEffect(() => {
    if (
      !sheet ||
      sheet.state !== "draft" ||
      !dirty ||
      busy ||
      conflict ||
      error
    )
      return;
    const t = setTimeout(() => {
      void persist(draft);
    }, 550);
    return () => clearTimeout(t);
  }, [draft, sheet, busy, dirty, conflict, error]);
  useEffect(() => {
    if (!sheet || !draft.lines.length) {
      setLayout(null);
      setLayoutError("");
      return;
    }
    let stopped = false;
    const timer = setTimeout(() => {
      api("/layout", { method: "POST", body: JSON.stringify(draft) })
        .then((d) => {
          if (!stopped) {
            setLayout(d);
            setLayoutError("");
          }
        })
        .catch((e) => {
          if (!stopped) {
            setLayout(null);
            setLayoutError(e.message);
          }
        });
    }, 400);
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [draft, sheet?.id]);
  function select(s: Sheet) {
    if (working.current) return;
    if (
      dirty &&
      !confirm("Du har endringer som ikke er lagret. Forlate lappen?")
    )
      return;
    current.current = s;
    saved.current = JSON.stringify(s.body);
    setSheet(s);
    setDraft(s.body);
    setError("");
    setConflict(false);
    setPreview(false);
    setForm(false);
    setRemoved(null);
    setPdfState("");
  }
  async function create() {
    if (busy) return;
    if (dirty && !(await persist(bodyRef.current))) return;
    setBusy(true);
    setError("");
    try {
      const body = emptyBody();
      const s = await api("/sheets", {
        method: "POST",
        body: JSON.stringify({
          id: crypto.randomUUID(),
          operation: crypto.randomUUID(),
          body,
        }),
      });
      accept(s);
      saved.current = JSON.stringify(body);
      setDraft(body);
      setPreview(false);
      setFilter("all");
      setForm(false);
      setRemoved(null);
      setPdfState("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function action(
    action: "lock" | "reopen" | "printed" | "delete" | "restore",
  ) {
    if (busy || working.current || !current.current) return;
    if (
      action === "delete" &&
      !confirm(
        "Flytte lappen til papirkurven? Den kan gjenopprettes i opptil 7 dager.",
      )
    )
      return;
    if (dirty && !(await persist(bodyRef.current))) return;
    if (action === "lock" && layoutError) {
      setError(layoutError);
      return;
    }
    setBusy(true);
    working.current = true;
    setError("");
    try {
      const data = await api(`/sheets/${current.current.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          action,
          version: current.current.version,
          operation: crypto.randomUUID(),
        }),
      });
      if (action === "delete") {
        const id = current.current.id;
        current.current = null;
        setSheet(null);
        setSheets((s) => [data, ...s.filter((x) => x.id !== id)]);
        saved.current = "";
        setDraft(emptyBody());
      } else {
        accept(data);
        setDraft(data.body);
        saved.current = JSON.stringify(data.body);
        if (action === "restore") setFilter("all");
        if (action === "lock") {
          setPreview(true);
          setPdfState("");
        }
      }
    } catch (e) {
      setError((e as Error).message);
      if (e instanceof RequestError && e.status === 409) setConflict(true);
    } finally {
      working.current = false;
      setBusy(false);
    }
  }
  useEffect(() => {
    if (!form || !validEan(ean)) {
      setLookupState("idle");
      setProduct(null);
      return;
    }
    const stored = bodyRef.current.lines.find((l) => l.ean === ean)?.product;
    if (stored && lookupRetry === 0) {
      setProduct(stored);
      setLookupState("found");
      return;
    }
    let cancelled = false;
    const controller = new AbortController();
    setLookupState("loading");
    setProductChoices([]);
    setLookupMessage("");
    const timer = setTimeout(() => {
      api("/products", {
        method: "POST",
        body: JSON.stringify({ ean }),
        signal: controller.signal,
      })
        .then((result) => {
          if (cancelled) return;
          setLookupState(result.status);
          if (result.status === "found") {
            setProduct(result.product);
            if (!nameTouched.current) setName(result.product.name);
            setTimeout(() => {
              if (!cancelled && !nameTouched.current)
                quantityInput.current?.focus();
            }, 50);
          } else if (result.status === "ambiguous")
            setProductChoices(result.products);
          else if (result.status === "unavailable")
            setLookupMessage(result.message);
          if (
            (result.status === "not_found" ||
              result.status === "unavailable") &&
            !nameTouched.current
          )
            nameInput.current?.focus();
        })
        .catch((e) => {
          if (!cancelled) {
            setLookupState("unavailable");
            setLookupMessage(e.message);
          }
        });
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
      controller.abort();
    };
  }, [form, ean, lookupRetry]);
  function chooseProduct(selected: Product) {
    setProduct(selected);
    setLookupState("found");
    if (!nameTouched.current) setName(selected.name);
    quantityInput.current?.focus();
  }
  function openForm(code = "", line?: Line) {
    nameTouched.current = Boolean(line);
    setProduct(line?.product || null);
    setLookupState(line?.product ? "found" : "idle");
    setLookupRetry(0);
    setProductChoices([]);
    setEan(line?.ean || code);
    setName(line?.name || "");
    setQty(line ? String(line.quantity) : "");
    setEditId(line?.id || null);
    setDuplicate(null);
    setFormError("");
    setForm(true);
    setScanner(false);
    setTimeout(() => {
      if (line) quantityInput.current?.focus();
      else if (code) quantityInput.current?.focus();
    }, 50);
  }
  function read(code: string) {
    const previous = draft.lines.find((l) => l.ean === code);
    openForm(code);
    if (previous) {
      nameTouched.current = true;
      setName(previous.name);
      setProduct(previous.product || null);
      setDuplicate(previous);
    }
  }
  function addLine(mode: "add" | "replace" = "add", scanNext = false) {
    if (!validEan(ean)) {
      setFormError(
        "Skriv en gyldig EAN-8 eller EAN-13 med riktig kontrollsiffer.",
      );
      return;
    }
    if (!name.trim()) {
      setFormError("Skriv inn varenavnet.");
      return;
    }
    if (!/^\d+$/.test(qty) || !Number.isSafeInteger(Number(qty))) {
      setFormError("Antall må være et heltall fra 0.");
      return;
    }
    const existing = draft.lines.find((l) => l.ean === ean && l.id !== editId);
    if (existing && !duplicate && !editId) {
      setDuplicate(existing);
      return;
    }
    const productData = product?.ean === ean ? product : undefined;
    let lines: Line[];
    if (existing && !editId) {
      const n = mode === "add" ? existing.quantity + Number(qty) : Number(qty);
      if (!Number.isSafeInteger(n)) {
        setFormError("Antallet er for stort.");
        return;
      }
      lines = draft.lines.map((l) =>
        l.id === existing.id
          ? {
              ...l,
              name: name.trim(),
              quantity: n,
              product: productData || l.product,
            }
          : l,
      );
    } else if (editId) {
      if (existing) {
        setFormError(
          "Denne EAN finnes på en annen linje. Avbryt og skann den for å legge til eller erstatte.",
        );
        return;
      }
      lines = draft.lines.map((l) =>
        l.id === editId
          ? {
              ...l,
              ean,
              name: name.trim(),
              quantity: Number(qty),
              product: productData,
            }
          : l,
      );
    } else
      lines = [
        ...draft.lines,
        {
          id: crypto.randomUUID(),
          ean,
          name: name.trim(),
          quantity: Number(qty),
          ...(productData ? { product: productData } : {}),
        },
      ];
    setDraft({ ...draft, lines });
    setError("");
    setForm(false);
    setDuplicate(null);
    if (scanNext) setScanner(true);
  }
  function remove(line: Line) {
    setRemoved({ line, index: draft.lines.findIndex((l) => l.id === line.id) });
    setDraft({ ...draft, lines: draft.lines.filter((l) => l.id !== line.id) });
    setError("");
  }
  function undo() {
    if (!removed) return;
    const lines = [...draft.lines];
    lines.splice(removed.index, 0, removed.line);
    setDraft({ ...draft, lines });
    setRemoved(null);
    setError("");
  }
  async function reload() {
    if (!sheet) return;
    if (
      dirty &&
      !confirm("Erstatte lokale endringer med siste lagrede versjon?")
    )
      return;
    try {
      const s = await api(`/sheets/${sheet.id}`);
      saved.current = JSON.stringify(s.body);
      accept(s);
      setDraft(s.body);
      setConflict(false);
      setError("");
    } catch (e) {
      setError((e as Error).message);
    }
  }
  async function openPdf(update = false) {
    if (!sheet || busy || working.current) return;
    const id = sheet.id;
    const previousWindow = pdfWindowRef.current;
    const pdfWindow =
      update && previousWindow && !previousWindow.closed
        ? previousWindow
        : window.open("about:blank", "_blank");
    const newWindow = pdfWindow !== previousWindow;
    if (dirty && !(await persist(bodyRef.current))) {
      if (newWindow) pdfWindow?.close();
      return;
    }
    working.current = true;
    setBusy(true);
    setPdfState("PDF klargjøres …");
    setError("");
    try {
      let latest: Sheet = await api(`/sheets/${id}`);
      if (latest.deleted_at) throw new Error("Lappen ligger i papirkurven.");
      if (update && latest.state === "draft") {
        latest = await api(`/sheets/${id}`, {
          method: "PATCH",
          body: JSON.stringify({
            action: "lock",
            version: latest.version,
            operation: crypto.randomUUID(),
          }),
        });
      }
      accept(latest);
      saved.current = JSON.stringify(latest.body);
      setDraft(latest.body);
      setConflict(false);
      setPreview(true);
      if (latest.state !== "locked")
        throw new Error(
          "Lappen er åpnet for redigering. Velg Oppdater PDF for å låse og hente en ny utskrift.",
        );
      const response = await fetch(`${API}/sheets/${id}/pdf`, {
        cache: "no-store",
      });
      if (!response.ok) {
        const d = await response.json();
        throw new Error(d.error || "PDF-feil");
      }
      const blob = await response.blob(),
        url = URL.createObjectURL(blob);
      if (pdfWindow) {
        pdfWindowRef.current = pdfWindow;
        pdfWindow.opener = null;
        pdfWindow.location.href = url;
      } else {
        const a = document.createElement("a");
        a.href = url;
        a.download = `merkelapp-${id.slice(0, 8)}-r${latest.revision}.pdf`;
        a.click();
      }
      setTimeout(() => URL.revokeObjectURL(url), 120000);
      const missingImages = Number(
        response.headers.get("X-Missing-Images") || 0,
      );
      setPdfState(
        missingImages
          ? `PDF klar, men ${missingImages} produktbilde(r) kunne ikke hentes. Åpne PDF-en igjen for å prøve på nytt.`
          : "PDF klar. Velg A3 og faktisk størrelse / 100 %.",
      );
    } catch (e) {
      if (newWindow) pdfWindow?.close();
      setPdfState("PDF-feil – prøv igjen.");
      setError((e as Error).message);
    } finally {
      working.current = false;
      setBusy(false);
    }
  }
  const trashed = Boolean(sheet?.deleted_at);
  const locked = sheet?.state === "locked" || trashed,
    lineCount = draft.lines.length,
    pageCount = layout?.pages.length;
  const visible = sheets.filter(
    (s) =>
      (filter === "trash"
        ? Boolean(s.deleted_at)
        : !s.deleted_at && (filter === "all" || s.state === filter)) &&
      (!query ||
        JSON.stringify([
          s.body.title,
          s.body.date,
          s.body.location,
          s.id,
          ...s.body.lines.map((l) => [l.name, l.ean]),
        ])
          .toLowerCase()
          .includes(query.toLowerCase())),
  );
  return (
    <>
      <header className="app-header">
        <div className="header-inner">
          <a href="https://jobbverktoy.no" className="portal-logo">
            <img src="https://jobbverktoy.no/logo.svg" alt="Jobbverktøy" />
          </a>
          <span className="header-divider" />
          <a className="app-brand" href="/merkelapp">
            <span className="brand-icon">
              <Tag size={20} />
            </span>
            Merkelapp
          </a>
          <span className="test-badge">Første utgave</span>
          <span className="account-name">{account?.name}</span>
        </div>
      </header>
      {loading ? (
        <main className="gate">
          <LoaderCircle className="spin" />
          <p>Henter lappene dine …</p>
        </main>
      ) : gate ? (
        <main className="gate">
          <LockKeyhole size={36} />
          <h1>Merkelapp</h1>
          <p>{gate}</p>
          <a className="button primary" href="https://jobbverktoy.no/logg-inn">
            Åpne Jobbverktøy <ArrowRight size={18} />
          </a>
        </main>
      ) : (
        <main className="workspace">
          <aside className={`sidebar ${sheet ? "mobile-hidden" : ""}`}>
            <div className="sidebar-heading">
              <div>
                <span className="eyebrow">DITT ARBEIDSOMRÅDE</span>
                <h1>
                  Mine lapper
                  <span>{sheets.filter((s) => !s.deleted_at).length}</span>
                </h1>
              </div>
              <button
                className="button primary"
                onClick={create}
                disabled={busy}
              >
                <Plus size={19} /> Ny lapp
              </button>
            </div>
            <div className="sheet-sync">
              <span role="status">
                {syncError || "Oppdateres automatisk hvert 5. sekund"}
              </span>
              <button
                className="icon-button"
                onClick={() => syncSheets()}
                aria-label="Oppdater lapper"
                title="Oppdater lapper nå"
                disabled={syncing || busy}
              >
                <RefreshCw size={17} className={syncing ? "spin" : ""} />
              </button>
            </div>
            <div className="search-field">
              <Search size={18} />
              <input
                aria-label="Søk i lapper"
                placeholder="Søk vare, EAN eller dato"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            <div className="filters">
              {[
                ["all", "Alle"],
                ["draft", "Utkast"],
                ["locked", "Låste"],
                ["trash", "Papirkurv"],
              ].map(([v, label]) => (
                <button
                  key={v}
                  className={filter === v ? "selected" : ""}
                  onClick={() => setFilter(v as typeof filter)}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="sheet-list">
              {visible.map((s) => (
                <button
                  key={s.id}
                  className={`sheet-card ${sheet?.id === s.id ? "selected" : ""}`}
                  onClick={() => select(s)}
                  disabled={busy}
                >
                  <span className={`sheet-symbol ${s.state}`}>
                    <FileText size={21} />
                  </span>
                  <span className="sheet-card-copy">
                    <strong>
                      {s.body.title || `Lapp ${dateLabel(s.body.date)}`}
                    </strong>
                    <span>
                      {dateLabel(s.body.date)} · {s.body.lines.length}{" "}
                      {s.body.lines.length === 1 ? "vare" : "varer"}
                    </span>
                    <span className={`status small ${s.state}`}>
                      {s.state === "locked" ? (
                        <LockKeyhole size={11} />
                      ) : (
                        <span className="dot" />
                      )}
                      {s.deleted_at
                        ? "Papirkurv"
                        : s.state === "locked"
                          ? "Låst"
                          : "Utkast"}
                      {s.delete_after
                        ? " · Slettes " +
                          dateLabel(osloDate(new Date(s.delete_after)))
                        : ""}
                    </span>
                  </span>
                  <ChevronRight size={16} />
                </button>
              ))}
              {!visible.length && (
                <div className="list-empty">
                  <FolderOpen size={29} />
                  <p>
                    {query
                      ? "Ingen lapper passer søket."
                      : "Lappene dine dukker opp her."}
                  </p>
                </div>
              )}
            </div>
            <div className="sidebar-note">
              <Cloud size={18} />
              <p>
                Lagres på kontoen din.
                <br />
                Tilgjengelig på mobil og PC.
              </p>
            </div>
          </aside>
          <section className="editor">
            {!sheet && error && (
              <div className="error-banner" role="alert">
                {error}
              </div>
            )}
            {!sheet ? (
              <div className="welcome">
                <span className="welcome-icon">
                  <ScanLine size={42} />
                </span>
                <span className="eyebrow">FRA STREKKODE TIL FERDIG LAPP</span>
                <h2>Skann. Tell. Skriv ut.</h2>
                <p>
                  Samle varene på én lapp.
                  <br />
                  Vi fordeler dem på tydelige A3-ark.
                </p>
                <button
                  className="button primary large"
                  onClick={create}
                  disabled={busy}
                >
                  <Plus size={20} /> Start en ny lapp
                </button>
                <div className="welcome-steps">
                  <span>
                    <ScanLine /> Skann varer
                  </span>
                  <i />
                  <span>
                    <Hash /> Oppgi antall
                  </span>
                  <i />
                  <span>
                    <Printer /> Skriv ut A3
                  </span>
                </div>
              </div>
            ) : (
              <>
                <button
                  className="back-mobile text-button"
                  onClick={() => {
                    if (
                      !busy &&
                      (!dirty || confirm("Forlate ulagrede endringer?"))
                    ) {
                      setSheet(null);
                      current.current = null;
                      saved.current = "";
                    }
                  }}
                >
                  <ArrowLeft size={16} /> Mine lapper
                </button>
                <div className="editor-top">
                  <div>
                    <span className="eyebrow">
                      LAPP {sheet.id.slice(0, 8).toUpperCase()}
                    </span>
                    <h2>{draft.title || "Ny varetelling"}</h2>
                    <div className="editor-sub">
                      <span className={`status ${sheet.state}`}>
                        {locked ? (
                          <LockKeyhole size={12} />
                        ) : (
                          <span className="dot" />
                        )}
                        {trashed
                          ? "I papirkurven"
                          : locked
                            ? `Låst · revisjon ${sheet.revision}`
                            : "Utkast"}
                      </span>
                      <span
                        className={`save-status ${error && dirty ? "failed" : ""}`}
                        role="status"
                      >
                        {busy ? (
                          <>
                            <LoaderCircle size={13} className="spin" /> Lagrer …
                          </>
                        ) : error && dirty ? (
                          <>
                            <WifiOff size={13} /> Ikke lagret
                          </>
                        ) : dirty ? (
                          <>
                            <Cloud size={13} /> Venter på lagring
                          </>
                        ) : (
                          <>
                            <CheckCircle2 size={13} /> Lagret på kontoen
                          </>
                        )}
                      </span>
                    </div>
                  </div>
                  <button
                    className="icon-button delete-sheet"
                    title="Flytt til papirkurven"
                    aria-label="Slett lapp"
                    onClick={() => action("delete")}
                    disabled={busy || trashed}
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
                {error && (
                  <div className="error-banner" role="alert">
                    <span>{error}</span>
                    {conflict ? (
                      <button onClick={reload}>Last inn lagret versjon</button>
                    ) : (
                      <button
                        disabled={busy}
                        onClick={() => {
                          setError("");
                          void persist(bodyRef.current);
                        }}
                      >
                        Prøv igjen
                      </button>
                    )}
                  </div>
                )}
                <div className="metadata-grid">
                  <label>
                    Navn på lappen
                    <input
                      disabled={locked}
                      maxLength={100}
                      placeholder="F.eks. Skruer · reol 4"
                      value={draft.title}
                      onChange={(e) => {
                        setDraft({ ...draft, title: e.target.value });
                        setError("");
                      }}
                    />
                  </label>
                  <label>
                    Telledato
                    <input
                      aria-label="Telledato"
                      type="date"
                      disabled={locked}
                      value={draft.date}
                      onChange={(e) => {
                        setDraft({ ...draft, date: e.target.value });
                        setError("");
                      }}
                    />
                  </label>
                  <label>
                    Sone / plassering <span>valgfritt</span>
                    <input
                      disabled={locked}
                      maxLength={120}
                      placeholder="F.eks. Gang 12"
                      value={draft.location}
                      onChange={(e) => {
                        setDraft({ ...draft, location: e.target.value });
                        setError("");
                      }}
                    />
                  </label>
                </div>
                <div className="editor-tabs">
                  <button
                    className={!preview ? "active" : ""}
                    onClick={() => setPreview(false)}
                  >
                    <Tag size={17} /> Varelinjer <span>{lineCount}</span>
                  </button>
                  <button
                    className={preview ? "active" : ""}
                    onClick={() => setPreview(true)}
                  >
                    <FileText size={17} /> A3-forhåndsvisning
                    {pageCount ? (
                      <span>
                        {pageCount} {pageCount === 1 ? "ark" : "ark"}
                      </span>
                    ) : null}
                  </button>
                </div>
                {preview ? (
                  <div className="preview-area">
                    {layoutError ? (
                      <div className="error-banner">{layoutError}</div>
                    ) : !lineCount ? (
                      <div className="empty-lines">
                        <FileText size={32} />
                        <h3>Legg til en vare først</h3>
                        <p>Her ser du hvordan varene fordeles på A3.</p>
                      </div>
                    ) : !layout ? (
                      <p className="muted">Beregner sidefordeling …</p>
                    ) : (
                      <>
                        <div className="preview-info">
                          <span>
                            <FileText size={15} /> {layout.pages.length} A3-ark
                            · {layout.pages.map((p) => p.count).join(" + ")}{" "}
                            varer
                          </span>
                          <span>Størrelsen tilpasses automatisk</span>
                        </div>
                        {layout.pages.map((p, i) => (
                          <div className="paper" key={i}>
                            <div className="paper-heading">
                              <strong>VARETELLING</strong>
                              <b>{dateLabel(draft.date)}</b>
                            </div>
                            {draft.location && (
                              <div className="paper-location">
                                {draft.location}
                              </div>
                            )}
                            <div
                              className="paper-column-head"
                              style={{
                                gridTemplateColumns: `${p.nameWidth}fr ${p.quantityWidth}fr ${p.barcodeWidth}fr`,
                              }}
                            >
                              <span>VARE / EAN</span>
                              <span>ANTALL</span>
                              <span>SKANN VARE</span>
                            </div>
                            <div className="paper-rows">
                              {p.lines.map((r) => {
                                const l = draft.lines.find(
                                  (l) => l.id === r.id,
                                )!;
                                return (
                                  <div
                                    className="paper-row"
                                    key={r.id}
                                    style={{
                                      flex: r.height,
                                      gridTemplateColumns: `${p.nameWidth}fr ${p.quantityWidth}fr ${p.barcodeWidth}fr`,
                                    }}
                                  >
                                    <div
                                      className={`paper-product ${r.stacked ? "paper-product-stacked" : ""}`}
                                      style={{
                                        gap: `${(r.imageGap * 100) / ((277 * 72) / 25.4)}cqw`,
                                      }}
                                    >
                                      {r.imageSize > 0 && (
                                        <div
                                          className="paper-photo"
                                          style={{
                                            width: `${(r.imageSize * 100) / ((277 * 72) / 25.4)}cqw`,
                                            height: `${(r.imageSize * 100) / ((277 * 72) / 25.4)}cqw`,
                                          }}
                                        >
                                          <ProductPhoto
                                            src={l.product?.imageUrl}
                                            name={l.name}
                                          />
                                        </div>
                                      )}
                                      <div className="paper-product-text">
                                        <strong
                                          style={{
                                            fontSize: `${(r.nameSize * 100) / ((277 * 72) / 25.4)}cqw`,
                                          }}
                                        >
                                          {r.nameLines.map((text, j) => (
                                            <span
                                              key={j}
                                              style={{ display: "block" }}
                                            >
                                              {text}
                                            </span>
                                          ))}
                                        </strong>
                                        <span
                                          style={{
                                            fontSize: `${(r.eanSize * 100) / ((277 * 72) / 25.4)}cqw`,
                                          }}
                                        >
                                          {l.ean}
                                        </span>
                                      </div>
                                    </div>
                                    <b
                                      className="paper-quantity"
                                      style={{
                                        fontSize: `${(r.quantitySize * 100) / ((277 * 72) / 25.4)}cqw`,
                                      }}
                                    >
                                      {l.quantity}
                                    </b>
                                    <div className="paper-barcode">
                                      <Barcode ean={l.ean} />
                                      <small>{l.ean}</small>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                            <div className="paper-footer">
                              <span>
                                {sheet.id.slice(0, 8).toUpperCase()} ·{" "}
                                {locked
                                  ? `Revisjon ${sheet.revision}`
                                  : "Utkast"}
                              </span>
                              <span>
                                Side {i + 1} av {layout.pages.length}
                              </span>
                            </div>
                          </div>
                        ))}
                        <p className="preview-disclaimer">
                          Forhåndsvisning av fordelingen. PDF-en har nøyaktige
                          A3-mål og vektorstrekkoder.
                        </p>
                      </>
                    )}
                  </div>
                ) : (
                  <>
                    {!locked && (
                      <div className="add-toolbar">
                        <button
                          className="button primary scan-button"
                          onClick={() => setScanner(true)}
                          disabled={busy || conflict}
                        >
                          <ScanLine size={23} /> Skann vare<span>Kamera</span>
                        </button>
                        <button
                          className="button secondary manual-button"
                          onClick={() => openForm()}
                          disabled={busy || conflict}
                        >
                          <Plus size={18} /> Legg til manuelt
                        </button>
                      </div>
                    )}
                    {removed && !locked && (
                      <div className="undo-bar">
                        <span>Varen er fjernet.</span>
                        <button onClick={undo}>
                          <Undo2 size={15} /> Angre
                        </button>
                      </div>
                    )}
                    <div className="lines-heading">
                      <span>
                        {lineCount} {lineCount === 1 ? "vare" : "varer"} på
                        lappen
                      </span>
                      <span>
                        {pageCount
                          ? `${pageCount} A3-${pageCount === 1 ? "ark" : "ark"}`
                          : "A3 stående"}
                      </span>
                    </div>
                    {!lineCount ? (
                      <div className="empty-lines">
                        <div className="empty-scan">
                          <ScanLine size={38} />
                        </div>
                        <h3>Klar for første vare</h3>
                        <p>
                          Skann strekkoden på varen og oppgi antall.
                          <br />
                          Du kan også skrive inn EAN manuelt.
                        </p>
                        <div className="empty-tip">
                          <Check size={14} /> Antall starter tomt. Du bestemmer
                          tallet.
                        </div>
                      </div>
                    ) : (
                      <div className="line-list">
                        {draft.lines.map((line, i) => (
                          <div className="line-card" key={line.id}>
                            <span className="line-number">
                              {String(i + 1).padStart(2, "0")}
                            </span>
                            {line.product?.imageUrl && (
                              <ProductPhoto
                                src={line.product.imageUrl}
                                name={line.name}
                              />
                            )}
                            <div className="line-copy">
                              <strong>{line.name}</strong>
                              <span>{line.ean}</span>
                            </div>
                            <div className="line-quantity">
                              <small>ANTALL</small>
                              <strong>{line.quantity}</strong>
                            </div>
                            {!locked && (
                              <div className="line-actions">
                                <button
                                  className="icon-button"
                                  aria-label={`Rediger ${line.name}`}
                                  onClick={() => openForm("", line)}
                                  disabled={busy || conflict}
                                >
                                  <Pencil size={16} />
                                </button>
                                <button
                                  className="icon-button"
                                  aria-label={`Fjern ${line.name}`}
                                  onClick={() => remove(line)}
                                  disabled={busy || conflict}
                                >
                                  <X size={17} />
                                </button>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}
                <footer className="editor-footer">
                  <div className="retention">
                    <CalendarDays size={17} />
                    <p>
                      {trashed ? (
                        <>
                          Ligger i papirkurven. Gjenopprett innen{" "}
                          {dateLabel(
                            osloDate(
                              new Date(
                                Math.min(
                                  new Date(sheet.deleted_at!).getTime() +
                                    7 * 86400000,
                                  sheet.delete_after
                                    ? new Date(sheet.delete_after).getTime()
                                    : Infinity,
                                ),
                              ),
                            ),
                          )}
                          .
                        </>
                      ) : sheet.delete_after ? (
                        <>
                          Slettes automatisk{" "}
                          <strong>
                            {dateLabel(osloDate(new Date(sheet.delete_after)))}
                          </strong>
                          .
                        </>
                      ) : (
                        <>
                          Beholdes frem til utskrift.
                          <br />
                          <span>
                            Slettes 7 dager etter «Markér som skrevet ut».
                          </span>
                        </>
                      )}
                    </p>
                  </div>
                  <div className="footer-actions">
                    {!trashed && (
                      <button
                        className="button secondary"
                        onClick={() => openPdf(true)}
                        disabled={busy || conflict || (dirty && !lineCount)}
                        title="Henter siste lagrede endringer, låser lappen og oppdaterer PDF-en"
                      >
                        <RefreshCw size={17} /> Oppdater PDF
                      </button>
                    )}
                    {trashed ? (
                      <button
                        className="button primary"
                        onClick={() => action("restore")}
                        disabled={busy}
                      >
                        <Undo2 size={17} /> Gjenopprett lapp
                      </button>
                    ) : locked ? (
                      <>
                        <button
                          className="button secondary"
                          onClick={() => action("reopen")}
                          disabled={busy}
                        >
                          Åpne for redigering
                        </button>
                        <button
                          className="button primary"
                          onClick={() => openPdf()}
                          disabled={busy || pdfState === "PDF klargjøres …"}
                        >
                          <Printer size={18} /> Åpne PDF
                        </button>
                      </>
                    ) : (
                      <button
                        className="button primary"
                        onClick={() => action("lock")}
                        disabled={
                          busy || conflict || !lineCount || Boolean(layoutError)
                        }
                      >
                        <LockKeyhole size={17} /> Lås for utskrift{" "}
                        <ArrowRight size={17} />
                      </button>
                    )}
                  </div>
                </footer>
                {locked && !trashed && (
                  <div className="print-confirm">
                    <div>
                      <strong>
                        {pdfState || "Lappen er låst og klar for PDF."}
                      </strong>
                      <p>
                        Endret fra en annen enhet? Velg Oppdater PDF for å hente
                        siste endringer. Har du skrevet ut? Bekreft under for å
                        starte nedtellingen til sletting.
                      </p>
                    </div>
                    <button
                      className="button secondary"
                      onClick={() => action("printed")}
                      disabled={busy || !!sheet.printed_at}
                    >
                      <CheckCircle2 size={17} />
                      {sheet.printed_at
                        ? "Markert som skrevet ut"
                        : "Markér som skrevet ut"}
                    </button>
                  </div>
                )}
              </>
            )}
          </section>
        </main>
      )}
      {scanner && <Scanner onRead={read} onClose={() => setScanner(false)} />}
      {form && (
        <div
          className="modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-labelledby="product-title"
        >
          <section className="product-modal">
            <div className="modal-header">
              <div>
                <span className="eyebrow">
                  {editId
                    ? "REDIGER VARE"
                    : ean
                      ? "KODE LEST"
                      : "MANUELL REGISTRERING"}
                </span>
                <h2 id="product-title">
                  {editId
                    ? "Endre vare"
                    : ean
                      ? "Kontroller varen"
                      : "Legg til vare"}
                </h2>
              </div>
              <button
                className="icon-button"
                onClick={() => setForm(false)}
                aria-label="Lukk vare"
              >
                <X />
              </button>
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                addLine("add");
              }}
            >
              <label>
                EAN
                <input
                  aria-label="EAN"
                  inputMode="numeric"
                  autoComplete="off"
                  value={ean}
                  maxLength={13}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      if (validEan(ean)) {
                        const l = draft.lines.find(
                          (l) => l.ean === ean && l.id !== editId,
                        );
                        if (l) {
                          setDuplicate(l);
                          nameTouched.current = true;
                          setName(l.name);
                          setProduct(l.product || null);
                        }
                        quantityInput.current?.focus();
                      } else
                        setFormError("Kontroller EAN og kontrollsifferet.");
                    }
                  }}
                  onChange={(e) => {
                    setEan(e.target.value.replace(/\s/g, ""));
                    setDuplicate(null);
                    setProduct(null);
                    setLookupRetry(0);
                    if (!nameTouched.current) setName("");
                  }}
                  onBlur={() => {
                    const l = draft.lines.find(
                      (l) => l.ean === ean && l.id !== editId,
                    );
                    if (l) {
                      setDuplicate(l);
                      nameTouched.current = true;
                      if (!name) setName(l.name);
                    }
                  }}
                />
              </label>
              <div
                className={`lookup-panel ${lookupState}`}
                role="status"
                aria-live="polite"
              >
                {lookupState === "loading" ? (
                  <>
                    <LoaderCircle size={17} className="spin" />
                    <span>
                      Kode lest. Henter varenavn og bilde fra Obs BYGG …
                    </span>
                  </>
                ) : lookupState === "found" && product ? (
                  <>
                    <ProductPhoto
                      src={product.imageUrl}
                      name={product.name}
                      large
                    />
                    <div className="lookup-product-copy">
                      <strong>{product.name}</strong>
                      <span>Hentet fra Obs BYGG · EAN verifisert</span>
                      <a
                        href={product.sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Se produkt og variant ↗
                      </a>
                    </div>
                  </>
                ) : lookupState === "ambiguous" ? (
                  <div className="lookup-choices">
                    <strong>Flere sikre EAN-treff. Velg riktig produkt:</strong>
                    {productChoices.map((choice) => (
                      <button
                        key={choice.sourceUrl + choice.name}
                        type="button"
                        onClick={() => chooseProduct(choice)}
                      >
                        <ProductPhoto
                          src={choice.imageUrl}
                          name={choice.name}
                        />
                        <span>{choice.name}</span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <>
                    <Tag size={17} />
                    <span>
                      {lookupState === "not_found"
                        ? "Fant ikke et sikkert EAN-treff hos Obs BYGG. Skriv inn varenavnet selv."
                        : lookupState === "unavailable"
                          ? lookupMessage ||
                            "Produktoppslaget er utilgjengelig. Du kan fortsette manuelt."
                          : "Skriv eller skann en gyldig EAN for å hente navn og bilde."}
                    </span>
                  </>
                )}
              </div>
              {(lookupState === "not_found" ||
                lookupState === "unavailable") && (
                <button
                  className="text-button lookup-retry"
                  type="button"
                  onClick={() => setLookupRetry((n) => n + 1)}
                >
                  Prøv produktoppslaget igjen
                </button>
              )}
              {lookupState === "found" && product && name !== product.name && (
                <button
                  className="text-button lookup-retry"
                  type="button"
                  onClick={() => {
                    nameTouched.current = true;
                    setName(product.name);
                  }}
                >
                  Bruk varenavnet fra Obs BYGG
                </button>
              )}
              <label>
                Varenavn
                <input
                  ref={nameInput}
                  aria-label="Varenavn"
                  autoComplete="off"
                  maxLength={500}
                  placeholder="Fullt navn og variant"
                  value={name}
                  onChange={(e) => {
                    nameTouched.current = true;
                    setName(e.target.value);
                  }}
                />
              </label>
              <label>
                Antall
                <input
                  ref={quantityInput}
                  className="quantity-input"
                  aria-label="Antall"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  placeholder="0"
                  value={qty}
                  onChange={(e) => setQty(e.target.value)}
                />
              </label>
              {duplicate && (
                <div className="duplicate-notice">
                  <strong>Varen finnes allerede: {duplicate.quantity}</strong>
                  <p>
                    Legg antallet til eksisterende antall, eller erstatt det.
                  </p>
                </div>
              )}
              {formError && (
                <p className="form-error" role="alert">
                  {formError}
                </p>
              )}
              <div className="product-buttons">
                {duplicate ? (
                  <>
                    <button
                      className="button primary"
                      type="button"
                      onClick={() => addLine("add")}
                    >
                      <Plus size={18} /> Legg til antall
                    </button>
                    <button
                      className="button secondary"
                      type="button"
                      onClick={() => addLine("replace")}
                    >
                      Erstatt antall
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      className="button primary"
                      type="button"
                      onClick={() => addLine("add", !editId)}
                    >
                      {editId ? <Check size={18} /> : <ScanLine size={18} />}{" "}
                      {editId ? "Lagre endring" : "Legg til og skann neste"}
                    </button>
                    {!editId && (
                      <button className="button secondary" type="submit">
                        Legg til og lukk
                      </button>
                    )}
                  </>
                )}
              </div>
              <button
                className="text-button cancel"
                type="button"
                onClick={() => setForm(false)}
              >
                Avbryt
              </button>
            </form>
          </section>
        </div>
      )}
    </>
  );
}
const L = [
  "0001101",
  "0011001",
  "0010011",
  "0111101",
  "0100011",
  "0110001",
  "0101111",
  "0111011",
  "0110111",
  "0001011",
];
const G = [
  "0100111",
  "0110011",
  "0011011",
  "0100001",
  "0011101",
  "0111001",
  "0000101",
  "0010001",
  "0001001",
  "0010111",
];
const parity = [
  "LLLLLL",
  "LLGLGG",
  "LLGGLG",
  "LLGGGL",
  "LGLLGG",
  "LGGLLG",
  "LGGGLL",
  "LGLGLG",
  "LGLGGL",
  "LGGLGL",
];
function Barcode({ ean }: { ean: string }) {
  const R = (d: string) =>
    L[+d].replace(/[01]/g, (c) => (c === "0" ? "1" : "0"));
  const bits =
    ean.length === 8
      ? "101" +
        [...ean.slice(0, 4)].map((d) => L[+d]).join("") +
        "01010" +
        [...ean.slice(4)].map(R).join("") +
        "101"
      : "101" +
        [...ean.slice(1, 7)]
          .map((d, i) => (parity[+ean[0]][i] === "L" ? L : G)[+d])
          .join("") +
        "01010" +
        [...ean.slice(7)].map(R).join("") +
        "101";
  return (
    <svg
      viewBox={`-11 0 ${bits.length + 18} 65`}
      role="img"
      aria-label={`Strekkode ${ean}`}
      preserveAspectRatio="xMidYMid meet"
    >
      {[...bits].map((b, i) =>
        b === "1" ? (
          <rect key={i} x={i} y="0" width="1" height="65" fill="black" />
        ) : null,
      )}
    </svg>
  );
}
