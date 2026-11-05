"use client";
import { Fragment, useEffect, useRef, useState, type ReactNode } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronRight,
  FileText,
  FolderOpen,
  Layers,
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
  SlidersHorizontal,
  Info,
  Ellipsis,
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
import {
  AREA_ROWS_PER_PAGE,
  calculation,
  changedSources,
  refreshedMerged,
  doubleCounted,
  inStore,
  mergedInto,
  sourceColor,
  mergeSheets,
  nextAreaTitle,
  sheetTitle,
} from "@/lib/area";
import { ownerCreatorName } from "@/lib/creator-name";
import { Dialog } from "./dialog";
import {
  canEditSheet,
  deletionDeadline,
  mergeContentsMatch,
  matchesSheetFilter,
  sheetStatus,
  type SheetFilter,
} from "@/lib/sheet-display";
import { Scanner } from "./scanner";
import { ProductPhoto } from "./product-photo";
import type { Product } from "@/lib/products";
const API = "/merkelapp/api",
  STORE_KEY = "merkelapp-store";
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
type AreaLayout = {
  area: true;
  pages: {
    rowShare: number;
    eanSize: number;
    calcSize: number;
    nameWidth: number;
    quantityWidth: number;
    barcodeWidth: number;
    count: number;
    lines: {
      id: string;
      side: "left" | "right";
      nameLines: string[];
      nameSize: number;
      quantitySize: number;
      calcLines: string[];
      breakdown: { label: string; quantity: string }[];
      breakdownSize: number;
    }[];
  }[];
};
// PDF points to preview width: the table spans 277 mm of the A3 page.
const cqw = (points: number) => `${(points * 100) / ((277 * 72) / 25.4)}cqw`;
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
function showPdf(pdfWindow: Window | null, blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  if (pdfWindow) {
    pdfWindow.opener = null;
    pdfWindow.location.href = url;
  } else {
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
  }
  setTimeout(() => URL.revokeObjectURL(url), 120000);
}
export function Workspace() {
  const [account, setAccount] = useState<{
      id: string;
      stores: { id: string; name: string }[];
      name: string;
      email: string;
      creatorName: string;
      canEditOthers?: boolean;
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
    [layout, setLayout] = useState<Layout | AreaLayout | null>(null),
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
    [filter, setFilter] = useState<SheetFilter>("all");
  const [view, setView] = useState<"sheets" | "area" | "trash">("sheets"),
    [picked, setPicked] = useState<Set<string>>(new Set()),
    [mergeError, setMergeError] = useState(""),
    [storeId, setStoreId] = useState("");
  const [gateStatus, setGateStatus] = useState(0);
  const [details, setDetails] = useState<{
    title: string;
    date: string;
    location: string;
  } | null>(null);
  const [detailsError, setDetailsError] = useState("");
  const [mergePreview, setMergePreview] = useState<SheetBody | null>(null);
  const [mergeName, setMergeName] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [batch, setBatch] = useState<{
    ids: string[];
    done: boolean;
    pages: number;
    missing: number;
    error: string;
    progress: string;
  } | null>(null);
  const batchPdf = useRef<{ blob: Blob; filename: string } | null>(null);
  const [notice, setNotice] = useState("");
  const [confirmation, setConfirmation] = useState<{
    title: string;
    text: string;
    label: string;
    resolve: (yes: boolean) => void;
  } | null>(null);
  const ask = (title: string, text: string, label: string) =>
    new Promise<boolean>((resolve) =>
      setConfirmation({ title, text, label, resolve }),
    );
  function answer(yes: boolean) {
    confirmation?.resolve(yes);
    setConfirmation(null);
  }
  async function goTo(next: typeof view) {
    if (busy || working.current) return;
    if (
      dirty &&
      !(await persist(bodyRef.current)) &&
      !(await ask(
        "Forlate ulagrede endringer?",
        "Vi kunne ikke lagre endringene. Hvis du fortsetter, forkastes de lokale endringene.",
        "Forlat lappen",
      ))
    )
      return;
    setSheet(null);
    current.current = null;
    saved.current = "";
    setDraft(emptyBody());
    if (next !== view) setPicked(new Set());
    setView(next);
    setFilter("all");
    setQuery("");
    setError("");
    setMergeError("");
    setPreview(false);
    setNotice("");
  }
  async function saveDetails() {
    if (!details || busy || locked || conflict) return;
    const body = { ...bodyRef.current, ...details };
    setDetailsError("");
    if (await persist(body)) {
      setDraft(body);
      setDetails(null);
    } else
      setDetailsError(
        "Detaljene kunne ikke lagres. Prøv igjen, eller avbryt for å beholde de gamle opplysningene.",
      );
  }
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState("");
  const syncingRef = useRef(false);
  const interactionRef = useRef({ busy, form, scanner });
  interactionRef.current = {
    busy,
    form:
      form ||
      Boolean(details) ||
      Boolean(mergePreview) ||
      Boolean(batch) ||
      Boolean(confirmation),
    scanner,
  };
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
        const me = await api("/session");
        setAccount(me);
        let remembered = "";
        try {
          remembered = localStorage.getItem(STORE_KEY) || "";
        } catch {}
        setStoreId(
          me.stores.some((s: { id: string }) => s.id === remembered)
            ? remembered
            : me.stores[0]?.id || "",
        );
        await refresh();
      } catch (e) {
        setGate(e instanceof Error ? e.message : "Kunne ikke laste inn.");
        setGateStatus(e instanceof RequestError ? e.status : 0);
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
  async function select(s: Sheet) {
    if (working.current) return;
    if (
      dirty &&
      !(await ask(
        "Forlate lappen?",
        "Du har endringer som ikke er lagret. De lokale endringene blir forkastet hvis du fortsetter.",
        "Forlat lappen",
      ))
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
    setNotice("");
  }
  async function create() {
    if (busy) return;
    if (dirty && !(await persist(bodyRef.current))) return;
    setBusy(true);
    setError("");
    try {
      const body: SheetBody =
        view === "area"
          ? {
              ...emptyBody(),
              kind: "area",
              title: nextAreaTitle(inStore(sheets, storeId)),
            }
          : emptyBody();
      const s = await api("/sheets", {
        method: "POST",
        body: JSON.stringify({
          id: crypto.randomUUID(),
          operation: crypto.randomUUID(),
          body,
          store: view === "area" && storeId ? storeId : undefined,
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
  async function mergePicked(commit = false) {
    if (busy || working.current) return;
    if (dirty && !(await persist(bodyRef.current))) return;
    setBusy(true);
    setMergeError("");
    try {
      // Read fresh so counts saved from other devices are included.
      const list: Sheet[] = await api("/sheets?include_deleted=1");
      setSheets(list);
      const chosen = list.filter(
        (s) => picked.has(s.id) && Boolean(s.body.kind) && !s.deleted_at,
      );
      if (chosen.length < 2) throw new Error("Velg minst to lister.");
      const overlap = doubleCounted(chosen, list);
      if (overlap)
        throw new Error(
          `${overlap.within} inneholder allerede ${overlap.list}. Fjern en av dem, ellers telles varene to ganger.`,
        );
      const body = mergeSheets(chosen);
      if (!commit || !mergePreview || !mergeContentsMatch(body, mergePreview)) {
        if (commit)
          setMergeError(
            "En kildeliste er endret. Kontroller de oppdaterte antallene og bekreft på nytt.",
          );
        else setMergeName(body.title);
        setMergePreview(body);
        return;
      }
      const named = { ...body, title: mergeName.trim() || body.title };
      const s = await api("/sheets", {
        method: "POST",
        body: JSON.stringify({
          id: crypto.randomUUID(),
          operation: crypto.randomUUID(),
          body: named,
          store: storeId || undefined,
        }),
      });
      accept(s);
      saved.current = JSON.stringify(named);
      setDraft(named);
      setPicked(new Set());
      setMergePreview(null);
      setPreview(false);
      setFilter("all");
      setForm(false);
      setRemoved(null);
      setPdfState("");
      setError("");
      setConflict(false);
    } catch (e) {
      setMergeError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  // Whoever may edit a merged list keeps it in step with its sublists.
  async function refreshMergedLists() {
    if (working.current || interactionRef.current.busy || !account) return;
    for (const s of sheets) {
      if (
        s.body.kind !== "merged" ||
        s.deleted_at ||
        s.state !== "draft" ||
        !canEditSheet(s, account)
      )
        continue;
      const next = refreshedMerged(s, sheets);
      const open = current.current?.id === s.id;
      if (
        !next ||
        (open && JSON.stringify(bodyRef.current) !== saved.current)
      )
        continue;
      working.current = true;
      try {
        const data: Sheet = await api(`/sheets/${s.id}`, {
          method: "PATCH",
          body: JSON.stringify({
            action: "save",
            version: s.version,
            operation: crypto.randomUUID(),
            body: next,
          }),
        });
        if (current.current?.id === s.id) {
          accept(data);
          saved.current = JSON.stringify(data.body);
          setDraft(data.body);
        } else
          setSheets((list) => list.map((x) => (x.id === s.id ? data : x)));
      } catch {
        // A conflict or network error is retried on the next sync.
      } finally {
        working.current = false;
      }
      return;
    }
  }
  useEffect(() => {
    const t = setTimeout(() => void refreshMergedLists(), 400);
    return () => clearTimeout(t);
  }, [sheets, account, busy]);
  function chooseStore(id: string) {
    setStoreId(id);
    setPicked(new Set());
    setMergeError("");
    try {
      localStorage.setItem(STORE_KEY, id);
    } catch {}
  }
  function togglePicked(id: string) {
    setMergeError("");
    setPicked((list) => {
      const next = new Set(list);
      if (!next.delete(id)) next.add(id);
      return next;
    });
  }
  async function action(
    action: "lock" | "reopen" | "printed" | "delete" | "restore",
  ) {
    if (busy || working.current || !current.current) return;
    if (
      action === "delete" &&
      !(await ask(
        "Flytte lappen til papirkurven?",
        `${sheetTitle(current.current.body)} kan gjenopprettes frem til slettefristen. En tidligere frist etter utskrift gjelder fortsatt.`,
        "Flytt til papirkurv",
      ))
    )
      return;
    if (dirty && !(await persist(bodyRef.current))) return;
    if (action === "lock" && layoutError) {
      setError(layoutError);
      return;
    }
    if (action === "lock") {
      const next = refreshedMerged(current.current, sheets);
      if (next) {
        if (!(await persist(next))) return;
        setDraft(next);
      }
    }
    setBusy(true);
    working.current = true;
    setError("");
    setNotice("");
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
        setNotice("Lappen er flyttet til papirkurven.");
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
              parts: undefined,
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
              // A hand-edited total no longer matches the merged calculation.
              parts:
                l.quantity === Number(qty) && l.ean === ean
                  ? l.parts
                  : undefined,
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
    setNotice(editId ? "Varen er oppdatert." : "Varen er lagt til.");
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
      !(await ask(
        "Last inn lagret versjon?",
        "Lappen er endret på en annen enhet. Dette erstatter dine lokale endringer med siste lagrede versjon.",
        "Last inn versjonen",
      ))
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
  async function openPdf() {
    if (!sheet || busy || working.current) return;
    const id = sheet.id;
    const pdfWindow = window.open("about:blank", "_blank");
    if (dirty && !(await persist(bodyRef.current))) {
      pdfWindow?.close();
      return;
    }
    working.current = true;
    setBusy(true);
    setPdfState("PDF klargjøres …");
    setError("");
    try {
      const latest: Sheet = await api(`/sheets/${id}`);
      if (latest.deleted_at) throw new Error("Lappen ligger i papirkurven.");
      accept(latest);
      saved.current = JSON.stringify(latest.body);
      setDraft(latest.body);
      setConflict(false);
      setPreview(true);
      if (latest.state !== "locked")
        throw new Error(
          "Lappen er åpnet for redigering på en annen enhet. Kontroller endringene og lås lappen på nytt før utskrift.",
        );
      const response = await fetch(`${API}/sheets/${id}/pdf`, {
        cache: "no-store",
      });
      if (!response.ok) {
        const d = await response.json();
        throw new Error(d.error || "PDF-feil");
      }
      showPdf(
        pdfWindow,
        await response.blob(),
        `merkelapp-${id.slice(0, 8)}-r${latest.revision}.pdf`,
      );
      const missingImages = Number(
        response.headers.get("X-Missing-Images") || 0,
      );
      setPdfState(
        missingImages
          ? `PDF klar, men ${missingImages} produktbilde(r) kunne ikke hentes. Åpne PDF-en igjen for å prøve på nytt.`
          : "PDF klar. Velg A3 og faktisk størrelse / 100 %.",
      );
    } catch (e) {
      pdfWindow?.close();
      setPdfState("PDF-feil – prøv igjen.");
      setError((e as Error).message);
    } finally {
      working.current = false;
      setBusy(false);
    }
  }
  // Each sheet comes from its own PDF route, so a large selection cannot hit the server's time limit.
  // The tab opens on a separate tap afterwards: a phone can suspend this page while a new tab has focus.
  async function printBatch() {
    if (!batch || busy || working.current) return;
    working.current = true;
    setBusy(true);
    setBatch({ ...batch, error: "", progress: "Henter lappene …" });
    try {
      const list: Sheet[] = await api("/sheets?include_deleted=1");
      const chosen = batch.ids
        .map((id) => list.find((s) => s.id === id))
        .filter(
          (s): s is Sheet =>
            Boolean(s) && !s!.deleted_at && s!.body.lines.length > 0,
        );
      if (!chosen.length) throw new Error("Ingen av lappene har varer.");
      setBatch({ ...batch, error: "", progress: "Låser utkast …" });
      for (const [i, s] of chosen.entries()) {
        if (s.state === "locked") continue;
        chosen[i] = await api(`/sheets/${s.id}`, {
          method: "PATCH",
          body: JSON.stringify({
            action: "lock",
            version: s.version,
            operation: crypto.randomUUID(),
          }),
        });
      }
      setSheets(
        list.map((s) => chosen.find((updated) => updated.id === s.id) || s),
      );
      const files: Uint8Array[] = new Array(chosen.length);
      let next = 0,
        finished = 0,
        missing = 0;
      const report = () =>
        setBatch({
          ...batch,
          error: "",
          progress: `Lager PDF: ${finished} av ${chosen.length} lapper`,
        });
      report();
      await Promise.all(
        Array.from({ length: Math.min(3, chosen.length) }, async () => {
          while (next < chosen.length) {
            const i = next++;
            const response = await fetch(`${API}/sheets/${chosen[i].id}/pdf`, {
              cache: "no-store",
            });
            if (!response.ok)
              throw new Error(
                `${sheetTitle(chosen[i].body)}: ${(await response.json()).error || "PDF-feil"}`,
              );
            missing += Number(response.headers.get("X-Missing-Images") || 0);
            files[i] = new Uint8Array(await response.arrayBuffer());
            finished++;
            report();
          }
        }),
      );
      const { combinePdfs } = await import("@/lib/combine-pdf");
      const { bytes, pages } = await combinePdfs(
        files,
        `Merkelapp ${chosen.length} lapper`,
      );
      batchPdf.current = {
        blob: new Blob([new Uint8Array(bytes)], { type: "application/pdf" }),
        filename: `merkelapp-${chosen.length}-lapper.pdf`,
      };
      setBatch({
        ids: chosen.map((s) => s.id),
        done: true,
        pages,
        missing,
        error: "",
        progress: "",
      });
    } catch (e) {
      setBatch({ ...batch, error: (e as Error).message, progress: "" });
      void refresh().catch(() => {});
    } finally {
      working.current = false;
      setBusy(false);
    }
  }
  async function markBatchPrinted() {
    if (!batch || busy || working.current) return;
    working.current = true;
    setBusy(true);
    let marked = 0;
    try {
      const list: Sheet[] = await api("/sheets?include_deleted=1");
      for (const id of batch.ids) {
        const s = list.find((x) => x.id === id);
        if (!s || s.printed_at || s.deleted_at) continue;
        await api(`/sheets/${id}`, {
          method: "PATCH",
          body: JSON.stringify({
            action: "printed",
            version: s.version,
            operation: crypto.randomUUID(),
          }),
        });
        marked++;
      }
      await refresh();
      setBatch(null);
      setPicked(new Set());
      setNotice(
        `${marked} ${marked === 1 ? "lapp er markert" : "lapper er markert"} som skrevet ut.`,
      );
    } catch (e) {
      setBatch({
        ...batch,
        error: `${marked} ble markert før feilen: ${(e as Error).message}`,
      });
      void refresh().catch(() => {});
    } finally {
      working.current = false;
      setBusy(false);
    }
  }
  const trashed = Boolean(sheet?.deleted_at);
  const foreign = Boolean(sheet && account && sheet.owner_id !== account.id),
    readOnly = Boolean(sheet && account && !canEditSheet(sheet, account)),
    stateLocked = sheet?.state === "locked" || trashed,
    locked = stateLocked || readOnly,
    sheetCreator = foreign
      ? ownerCreatorName(sheet?.owner_name ?? null)
      : account?.creatorName,
    storeName = account?.stores.find((s) => s.id === storeId)?.name,
    lineCount = draft.lines.length,
    pageCount = layout?.pages.length;
  const inView = inStore(sheets, storeId).filter((s) =>
    view === "trash"
      ? Boolean(s.deleted_at)
      : !s.deleted_at && Boolean(s.body.kind) === (view === "area"),
  );
  const mergeable = sheets.filter(
    (s) => picked.has(s.id) && Boolean(s.body.kind) && !s.deleted_at,
  );
  const printable = sheets.filter(
    (s) => picked.has(s.id) && !s.body.kind && !s.deleted_at,
  );
  const batchSheets = sheets.filter(
      (s) => batch?.ids.includes(s.id) && s.body.lines.length > 0,
    ),
    batchLines = batchSheets.length,
    batchDrafts = batchSheets.filter((s) => s.state !== "locked").length;
  const changed = sheet ? changedSources(draft, sheets) : [];
  const visible = inView.filter(
    (s) =>
      (view === "trash" || matchesSheetFilter(s, filter)) &&
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
  const inside = (s: Sheet) =>
    s.body.sources
      ?.map((source) => inView.find((x) => x.id === source.id))
      .filter((x): x is Sheet => Boolean(x) && !x!.deleted_at) || [];
  const renderSheet = (s: Sheet, nested = false): ReactNode => {
    const children = s.deleted_at ? [] : inside(s),
      open = expanded.has(s.id);
    return (
      <Fragment key={s.id}>
                <div
                  className={`sheet-row ${picked.has(s.id) ? "is-picked" : ""} ${nested ? "is-nested" : ""}`}
                >
                  {!s.deleted_at && !nested && (
                    <input
                      type="checkbox"
                      aria-label={`Velg ${sheetTitle(s.body)} for ${s.body.kind ? "sammenslåing" : "utskrift"}`}
                      checked={picked.has(s.id)}
                      disabled={busy}
                      onChange={() => togglePicked(s.id)}
                    />
                  )}
                  <button
                    className={`sheet-card ${sheet?.id === s.id ? "selected" : ""}`}
                    onClick={() => select(s)}
                    disabled={busy}
                  >
                    <span className={`sheet-symbol ${s.state}`}>
                      {s.body.kind ? <Layers size={21} /> : <FileText size={21} />}
                    </span>
                    <span className="sheet-card-copy">
                      <span className="sheet-name">
                        {view === "trash" && (
                          <span className={`sheet-type ${s.body.kind ? "area" : "label"}`}>
                            {s.body.kind ? <Layers size={13} aria-hidden="true" /> : <Tag size={13} aria-hidden="true" />}
                            {s.body.kind === "area" ? "Områdeliste" : s.body.kind === "merged" ? "Sammenslått liste" : "Lapp"}
                          </span>
                        )}
                        <strong>
                          {s.body.title || `Lapp ${dateLabel(s.body.date)}`}
                        </strong>
                        {s.body.location && <small>{s.body.location}</small>}
                      </span>
                      <span>
                        {dateLabel(s.body.date)} · {s.body.lines.length}{" "}
                        {s.body.lines.length === 1 ? "vare" : "varer"}
                        {account && s.owner_id !== account.id
                          ? ` · ${ownerCreatorName(s.owner_name)}`
                          : ""}
                      </span>
                      <span
                        className={`status small ${s.printed_at ? "printed" : s.state}`}
                      >
                        {s.state === "locked" ? (
                          <LockKeyhole size={11} />
                        ) : (
                          <span className="dot" />
                        )}
                        {sheetStatus(s)}
                        {s.body.kind === "merged" ? " · Sammenslått" : ""}
                        {deletionDeadline(s)
                          ? " · Slettes " +
                            dateLabel(osloDate(deletionDeadline(s)!))
                          : ""}
                      </span>
                      {s.body.sources && (
                        <span className="source-chips">
                          {s.body.sources.map((source, i) => (
                            <span className="source-chip" key={source.id}>
                              <i style={{ background: sourceColor(i) }} />
                              {source.title}
                            </span>
                          ))}
                        </span>
                      )}
                      {s.body.kind &&
                        !nested &&
                        mergedInto(s.id, sheets).map((m) => (
                          <span className="merged-into" key={m.id}>
                            <Layers size={11} /> Inngår i {sheetTitle(m.body)}
                          </span>
                        ))}
                    </span>
                    <ChevronRight size={16} />
                  </button>
                </div>
        {children.length > 0 && (
          <button
            className={`sheet-expand ${nested ? "is-nested" : ""}`}
            aria-expanded={open}
            onClick={() =>
              setExpanded((list) => {
                const next = new Set(list);
                if (!next.delete(s.id)) next.add(s.id);
                return next;
              })
            }
          >
            <ChevronRight size={16} className={open ? "is-open" : ""} />
            {open ? "Skjul" : "Vis"} {children.length}{" "}
            {children.length === 1 ? "underliste" : "underlister"}
          </button>
        )}
        {open && children.map((child) => renderSheet(child, true))}
      </Fragment>
    );
  };
  const hasParent = (s: Sheet) =>
    visible.some(
      (m) => !m.deleted_at && m.body.sources?.some((x) => x.id === s.id),
    );
  const listRows = visible.filter((s) => !hasParent(s)).map((s) => renderSheet(s));
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
          {account && !gate && (
            <nav className="app-nav" aria-label="Hovedmeny">
              {(
                [
                  ["sheets", "Varetellingslapp", FileText],
                  ["area", "Områder med varer flere steder", Layers],
                  ["trash", "Papirkurv", Trash2],
                ] as const
              ).map(([v, label, Icon]) => (
                <button
                  key={v}
                  className={`button ${view === v ? "selected" : "secondary"}`}
                  aria-current={view === v ? "page" : undefined}
                  onClick={() => goTo(v)}
                  disabled={busy}
                >
                  <Icon size={18} />
                  {label}
                </button>
              ))}
            </nav>
          )}
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
          <h1>
            {gateStatus === 401
              ? "Logg inn for å fortsette"
              : gateStatus === 403
                ? "Du mangler tilgang til Merkelapp"
                : "Kunne ikke hente lappene"}
          </h1>
          <p>{gate}</p>
          {gateStatus === 401 ? (
            <a
              className="button primary"
              href="https://jobbverktoy.no/logg-inn"
            >
              Logg inn
              <ArrowRight size={18} />
            </a>
          ) : gateStatus === 403 ? (
            <a className="button primary" href="https://jobbverktoy.no">
              Til Jobbverktøy
              <ArrowRight size={18} />
            </a>
          ) : (
            <button
              className="button primary"
              onClick={() => window.location.reload()}
            >
              <RefreshCw size={18} />
              Prøv igjen
            </button>
          )}
        </main>
      ) : (
        <main
          className={`workspace ${sheet ? "has-sheet" : "overview"} ${preview ? "is-preview" : ""}`}
        >
          <aside className={`sidebar ${sheet ? "mobile-hidden" : ""}`}>
            <div className="sidebar-heading">
              <div>
                <span className="eyebrow">DITT ARBEIDSOMRÅDE</span>
                <h1>
                  {view === "trash"
                    ? "Papirkurv"
                    : view === "area"
                      ? "Områdelister"
                      : "Merkelapp"}
                  <span>{inView.length}</span>
                </h1>
              </div>
              {view !== "trash" && (
                <button
                  className="button primary"
                  onClick={create}
                  disabled={busy}
                >
                  <Plus size={19} />{" "}
                  {view === "area" ? "Ny områdeliste" : "Ny lapp"}
                </button>
              )}
            </div>
            {view === "area" && (account?.stores.length || 0) > 1 && (
              <label className="store-picker">
                Varehus
                <select
                  value={storeId}
                  disabled={busy}
                  onChange={(e) => chooseStore(e.target.value)}
                >
                  {account?.stores.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <p className="overview-description">
              {view === "trash"
                ? "Gjenopprett lapper og områdelister før fristen som vises."
                : view === "area"
                  ? "Tell hvert område for seg. Slå sammen når du er klar."
                  : "Dine tellinger, klare til å fortsette på mobil eller PC. Merk av flere lapper for å skrive dem ut samlet."}
            </p>
            {notice && (
              <div className="success-banner" role="status">
                <CheckCircle2 size={18} />
                {notice}
              </div>
            )}
            {error && (
              <div className="error-banner" role="alert">
                {error}
              </div>
            )}
            <div className="sheet-sync">
              <span role={syncError ? "alert" : undefined}>
                {syncError || "Lappene holdes oppdatert automatisk"}
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
                placeholder="Søk navn, vare, EAN eller dato"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            {view !== "trash" && (
              <div className="filters" aria-label="Filtrer lapper">
                {[
                  ["all", "Alle"],
                  ["draft", "Utkast"],
                  ["locked", "Klare"],
                  ["printed", "Utskrevet"],
                ].map(([v, label]) => (
                  <button
                    key={v}
                    className={filter === v ? "selected" : ""}
                    aria-pressed={filter === v}
                    onClick={() => setFilter(v as typeof filter)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}
            {view === "area" && (
              <div className="merge-bar">
                <p>
                  {mergeable.length
                    ? mergeable
                        .map((s) => sheetTitle(s.body))
                        .sort((a, b) =>
                          a.localeCompare(b, "nb", { numeric: true }),
                        )
                        .join(", ")
                    : "Merk av listene du vil slå sammen."}
                </p>
                <p className="merge-bar-hint">
                  Du får en ny liste. Listene du velger beholdes som de er.
                </p>
                <button
                  className="button primary"
                  onClick={() => mergePicked()}
                  disabled={busy || mergeable.length < 2}
                >
                  <Layers size={17} /> Se sammenslåing ({mergeable.length}{" "}
                  valgt)
                </button>
                {mergeError && (
                  <p className="form-error" role="alert">
                    {mergeError}
                  </p>
                )}
              </div>
            )}
            {view === "sheets" && printable.length > 0 && (
              <div className="merge-bar">
                <p>
                  <strong>
                    {printable.length}{" "}
                    {printable.length === 1 ? "lapp valgt" : "lapper valgt"}
                  </strong>
                </p>
                <div className="print-bar-actions">
                  <button
                    className="button primary"
                    disabled={busy}
                    onClick={() =>
                      setBatch({
                        ids: visible
                          .concat(printable)
                          .filter((s) => picked.has(s.id) && !s.body.kind)
                          .map((s) => s.id)
                          .filter((id, i, ids) => ids.indexOf(id) === i),
                        done: false,
                        pages: 0,
                        missing: 0,
                        error: "",
                        progress: "",
                      })
                    }
                  >
                    <Printer size={18} /> Skriv ut valgte
                  </button>
                  {visible.some((s) => !picked.has(s.id)) && (
                    <button
                      className="button secondary"
                      disabled={busy}
                      onClick={() =>
                        setPicked(
                          new Set([...picked, ...visible.map((s) => s.id)]),
                        )
                      }
                    >
                      Velg alle ({visible.length})
                    </button>
                  )}
                  <button
                    className="button secondary"
                    disabled={busy}
                    onClick={() => setPicked(new Set())}
                  >
                    Fjern valg
                  </button>
                </div>
              </div>
            )}
            <div className="sheet-list">
              {visible.length > 0 && (
                <div className="sheet-columns" aria-hidden="true">
                  <span>{view === "trash" ? "Type / navn / plassering" : "Lapp / plassering"}</span>
                  <span>Telledato · varer</span>
                  <span>Status</span>
                </div>
              )}
              {listRows}
              {!visible.length && (
                <div className="list-empty">
                  <FolderOpen size={29} />
                  <p>
                    {query
                      ? "Ingen lapper passer søket."
                      : view === "trash"
                        ? "Papirkurven er tom."
                        : filter !== "all"
                          ? "Ingen lapper med denne statusen."
                          : view === "area"
                            ? "Lag én liste for hvert område, for eksempel Skruer 1."
                            : "Lag din første lapp for å begynne å telle."}
                  </p>
                  {query || filter !== "all" ? (
                    <button
                      className="button secondary"
                      onClick={() => {
                        setQuery("");
                        setFilter("all");
                      }}
                    >
                      Nullstill søk og filter
                    </button>
                  ) : (
                    view !== "trash" && (
                      <button
                        className="button primary"
                        disabled={busy}
                        onClick={create}
                      >
                        <Plus size={18} />
                        Lag første {view === "area" ? "områdeliste" : "lapp"}
                      </button>
                    )
                  )}
                </div>
              )}
            </div>
            <div className="sidebar-note">
              <Cloud size={18} />
              {view === "area" ? (
                <p>
                  {storeName
                    ? `Deles med alle på ${storeName}.`
                    : "Du er ikke knyttet til et varehus, så listene er bare synlige for deg."}{" "}
                  Bare den som laget en liste kan endre den.
                </p>
              ) : (
                <p>Lagret på kontoen din · tilgjengelig på mobil og PC.</p>
              )}
            </div>
          </aside>
          <section className="editor" aria-label="Valgt lapp">
            {sheet && (
              <>
                <div className="editor-back">
                  <button
                    className="button secondary"
                    onClick={() => goTo(view)}
                    disabled={busy}
                  >
                    <ArrowLeft size={18} />
                    {view === "trash"
                      ? "Papirkurv"
                      : draft.kind
                        ? "Områdelister"
                        : "Mine lapper"}
                  </button>
                </div>
                <div className="editor-top">
                  <div>
                    <h2>
                      {preview ? "Utskrift" : draft.title || "Ny varetelling"}
                    </h2>
                    {preview && (
                      <p className="preview-subtitle">
                        {draft.title || "Varetelling"} · {lineCount} varer ·{" "}
                        {pageCount || "–"} A3-ark
                      </p>
                    )}
                    <div className="editor-sub">
                      <span
                        className={`status ${sheet.printed_at ? "printed" : sheet.state}`}
                      >
                        {stateLocked ? (
                          <LockKeyhole size={12} />
                        ) : (
                          <span className="dot" />
                        )}
                        {sheetStatus(sheet)}
                        {stateLocked && !trashed
                          ? ` · revisjon ${sheet.revision}`
                          : ""}
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
                  {stateLocked && !trashed && !readOnly && (
                    <button
                      className="button primary"
                      disabled={busy}
                      onClick={async () => {
                        if (
                          !sheet.printed_at ||
                          (await ask(
                            "Åpne for redigering?",
                            "Listen er markert som skrevet ut. Hvis du åpner den, avbrytes slettefristen, og den må låses på nytt før utskrift.",
                            "Åpne for redigering",
                          ))
                        ) {
                          setPreview(false);
                          await action("reopen");
                        }
                      }}
                    >
                      <Pencil size={18} /> Rediger
                    </button>
                  )}
                  {!trashed && !foreign && (
                    <details className="sheet-menu">
                      <summary className="button secondary">
                        <Ellipsis size={18} />
                        <span>Flere valg</span>
                      </summary>
                      <div>
                        {" "}
                        <button
                          className="button secondary delete-sheet"
                          title="Flytt til papirkurven"
                          aria-label="Slett lapp"
                          onClick={() => action("delete")}
                          disabled={busy || trashed}
                        >
                          <Trash2 size={18} /> Flytt til papirkurv
                        </button>
                        <p>
                          Lappen kan gjenopprettes fra papirkurven frem til
                          slettefristen.
                        </p>
                      </div>
                    </details>
                  )}
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
                {foreign && (
                  <div className="merge-note">
                    <p>
                      {readOnly
                        ? `${sheetCreator} har laget listen. Du kan se den og slå den sammen med andre, men bare ${sheetCreator} kan endre den.`
                        : `${sheetCreator} har laget listen. Du kan endre navn og innhold, men ikke slette den eller markere den som skrevet ut.`}
                    </p>
                  </div>
                )}
                {draft.sources && (
                  <div className="merge-note">
                    <div className="merge-flow">
                      <div className="merge-flow-sources">
                        {draft.sources.map((source, i) => {
                          const list = sheets.find(
                            (s) => s.id === source.id && !s.deleted_at,
                          );
                          return (
                            <button
                              key={source.id}
                              disabled={!list || busy}
                              onClick={() => list && select(list)}
                            >
                              <i style={{ background: sourceColor(i) }} />
                              <strong>{source.title}</strong>
                              <span>
                                {list
                                  ? `${list.body.lines.length} ${list.body.lines.length === 1 ? "vare" : "varer"}`
                                  : "Slettet"}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                      <ArrowRight className="merge-flow-arrow" size={20} />
                      <div className="merge-flow-result">
                        <Layers size={16} />
                        <strong>{draft.title || "Sammenslått liste"}</strong>
                        <span>
                          {draft.lines.length}{" "}
                          {draft.lines.length === 1 ? "vare" : "varer"} · totalt{" "}
                          {draft.lines.reduce((n, l) => n + l.quantity, 0)} stk
                        </span>
                      </div>
                    </div>
                    {changed.length > 0 && (stateLocked || readOnly) && (
                      <p className="merge-note-warning" role="alert">
                        {changed.map((s) => s.title).join(", ")} er endret.{" "}
                        {readOnly
                          ? `Tallene oppdateres når ${sheetCreator} har appen åpen.`
                          : "Trykk Rediger for å oppdatere tallene her."}
                      </p>
                    )}
                  </div>
                )}
                {draft.kind &&
                  sheet &&
                  mergedInto(sheet.id, sheets).length > 0 && (
                    <div className="merge-note">
                      <p>
                        <Layers size={15} /> Denne listen inngår i:
                      </p>
                      <div className="merged-into-links">
                        {mergedInto(sheet.id, sheets).map((m) => (
                          <button
                            key={m.id}
                            disabled={busy}
                            onClick={() => select(m)}
                          >
                            {sheetTitle(m.body)} <ChevronRight size={14} />
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                {!preview && (
                  <div
                    className={`compact-metadata ${locked ? "read-only" : ""}`}
                  >
                    <span>
                      {dateLabel(draft.date)} ·{" "}
                      {draft.location || "Ingen plassering"}
                    </span>
                    {!locked && (
                      <button
                        className="button secondary"
                        disabled={busy || conflict}
                        onClick={() => {
                          setDetails({
                            title: draft.title,
                            date: draft.date,
                            location: draft.location,
                          });
                          setDetailsError("");
                        }}
                      >
                        <SlidersHorizontal size={17} />
                        Detaljer
                      </button>
                    )}
                  </div>
                )}
                {!preview && !locked && (
                  <div className="metadata-grid">
                    <label>
                      Navn på lappen
                      <input
                        disabled={locked}
                        maxLength={100}
                        placeholder={
                          draft.kind
                            ? "F.eks. Skruer 1"
                            : "F.eks. Skruer · reol 4"
                        }
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
                      <span className="field-label">
                        Plassering <em>Valgfritt</em>
                      </span>
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
                    <div className="metadata-save">
                      <button
                        className={`button ${dirty ? "primary" : "secondary"}`}
                        disabled={!dirty || busy || conflict}
                        onClick={() => void persist(bodyRef.current)}
                      >
                        {dirty ? (
                          "Lagre"
                        ) : (
                          <>
                            <Check size={17} /> Lagret
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                )}
                <div className="editor-tabs" aria-label="Visning av lappen">
                  <button
                    className={!preview ? "active" : ""}
                    aria-pressed={!preview}
                    onClick={() => {
                      setPreview(false);
                      setNotice("");
                    }}
                  >
                    <Tag size={17} /> Varer <span>{lineCount}</span>
                  </button>
                  <button
                    className={preview ? "active" : ""}
                    aria-pressed={preview}
                    onClick={() => {
                      setPreview(true);
                      setNotice("");
                    }}
                  >
                    <FileText size={17} /> Utskrift
                    {pageCount ? (
                      <span>
                        {pageCount} {pageCount === 1 ? "ark" : "ark"}
                      </span>
                    ) : null}
                  </button>
                </div>
                <div
                  className={preview ? "print-workspace" : "count-workspace"}
                >
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
                              <FileText size={15} /> {layout.pages.length}{" "}
                              A3-ark ·{" "}
                              {layout.pages.map((p) => p.count).join(" + ")}{" "}
                              varer
                            </span>
                            <span>
                              {"area" in layout
                                ? `Inntil ${AREA_ROWS_PER_PAGE} varer per ark`
                                : "Størrelsen tilpasses automatisk"}
                            </span>
                          </div>
                          {"area" in layout
                            ? layout.pages.map((p, i) => {
                                const side = p.quantityWidth + p.barcodeWidth;
                                return (
                                  <div className="paper" key={i}>
                                    <div className="paper-heading">
                                      <strong>VARETELLING</strong>
                                      <b>{dateLabel(draft.date)}</b>
                                    </div>
                                    <div className="paper-meta">
                                      <span className="area-paper-title">
                                        {[draft.title, draft.location]
                                          .filter(Boolean)
                                          .join(" · ")}
                                      </span>
                                      <strong>
                                        {sheetCreator
                                          ? `Laget av ${sheetCreator}`
                                          : ""}
                                      </strong>
                                    </div>
                                    {draft.sources && (
                                      <div className="area-paper-sources">
                                        Sammenslått av:{" "}
                                        {draft.sources
                                          .map((s) => s.title)
                                          .join(", ")}
                                      </div>
                                    )}
                                    <div
                                      className="paper-column-head"
                                      style={{
                                        gridTemplateColumns: `${side}fr ${p.nameWidth}fr ${side}fr`,
                                      }}
                                    >
                                      <span>ANTALL / STREKKODE</span>
                                      <span>VARE / EAN</span>
                                      <span>ANTALL / STREKKODE</span>
                                    </div>
                                    <div className="paper-rows">
                                      {p.lines.map((r) => {
                                        const l = draft.lines.find(
                                          (l) => l.id === r.id,
                                        );
                                        if (!l) return null;
                                        const scan = [
                                          <div
                                            className="area-paper-barcode"
                                            key="barcode"
                                          >
                                            <Barcode ean={l.ean} />
                                            <small>{l.ean}</small>
                                          </div>,
                                          <div
                                            className="area-paper-quantity"
                                            key="quantity"
                                          >
                                            {r.calcLines.map((text, j) => (
                                              <small
                                                key={j}
                                                style={{
                                                  fontSize: cqw(p.calcSize),
                                                }}
                                              >
                                                {text}
                                              </small>
                                            ))}
                                            <b
                                              style={{
                                                fontSize: cqw(r.quantitySize),
                                              }}
                                            >
                                              {l.quantity}
                                            </b>
                                          </div>,
                                        ];
                                        const text = (
                                          <div
                                            className="area-paper-name"
                                            key="name"
                                          >
                                            <strong
                                              style={{
                                                fontSize: cqw(r.nameSize),
                                              }}
                                            >
                                              {r.nameLines.map((name, j) => (
                                                <span key={j}>{name}</span>
                                              ))}
                                            </strong>
                                            <span
                                              style={{
                                                fontSize: cqw(p.eanSize),
                                              }}
                                            >
                                              {l.ean}
                                            </span>
                                          </div>
                                        );
                                        const blank = (
                                          <div
                                            className="area-paper-breakdown"
                                            key="blank"
                                            style={{
                                              fontSize: cqw(r.breakdownSize),
                                            }}
                                          >
                                            {r.breakdown.map((part) => (
                                              <div key={part.label}>
                                                <span>{part.label}</span>
                                                <b>{part.quantity}</b>
                                              </div>
                                            ))}
                                          </div>
                                        );
                                        return (
                                          <div
                                            className="area-paper-row"
                                            key={r.id}
                                            style={{
                                              flexBasis: `${100 * p.rowShare}%`,
                                              gridTemplateColumns:
                                                r.side === "right"
                                                  ? `${side}fr ${p.nameWidth}fr ${p.quantityWidth}fr ${p.barcodeWidth}fr`
                                                  : `${p.barcodeWidth}fr ${p.quantityWidth}fr ${p.nameWidth}fr ${side}fr`,
                                            }}
                                          >
                                            {r.side === "right"
                                              ? [blank, text, scan[1], scan[0]]
                                              : [scan[0], scan[1], text, blank]}
                                          </div>
                                        );
                                      })}
                                    </div>
                                    <div className="paper-footer">
                                      <span>
                                        Side {i + 1} av {layout.pages.length}
                                      </span>
                                    </div>
                                  </div>
                                );
                              })
                            : layout.pages.map((p, i) => (
                                <div className="paper" key={i}>
                                  <div className="paper-heading">
                                    <strong>VARETELLING</strong>
                                    <b>{dateLabel(draft.date)}</b>
                                  </div>
                                  <div className="paper-meta">
                                    <span>{draft.location}</span>
                                    <strong>
                                      {sheetCreator
                                        ? `Laget av ${sheetCreator}`
                                        : ""}
                                    </strong>
                                  </div>
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
                      {draft.kind === "merged" && (
                        <p className="merged-hint">
                          <Info size={16} /> Antallene kommer fra underlistene.
                          Endre dem der, så oppdateres summene her.
                        </p>
                      )}
                      {!locked && draft.kind !== "merged" && (
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
                            <Check size={14} /> Antall starter tomt. Du
                            bestemmer tallet.
                          </div>
                        </div>
                      ) : (
                        <div className="line-list">
                          {draft.lines.map((line, i) => (
                            <div className="line-card" key={line.id}>
                              <span className="line-number">
                                {String(i + 1).padStart(2, "0")}
                              </span>
                              <ProductPhoto
                                src={line.product?.imageUrl}
                                name={line.name}
                              />
                              <div className="line-copy">
                                <strong>{line.name}</strong>
                                <span>{line.ean}</span>
                                {line.parts && draft.sources && (
                                  <small className="line-sources">
                                    {line.parts.map((p) => (
                                      <span key={p.source}>
                                        <i
                                          style={{
                                            background: sourceColor(p.source),
                                          }}
                                        />
                                        {draft.sources![p.source]?.title}:{" "}
                                        {p.quantity}
                                      </span>
                                    ))}
                                  </small>
                                )}
                              </div>
                              <div className="line-quantity">
                                <small
                                  className={
                                    calculation(line) ? "line-calc" : ""
                                  }
                                >
                                  {calculation(line) || "ANTALL"}
                                </small>
                                <strong>{line.quantity}</strong>
                              </div>
                              {!locked && draft.kind !== "merged" && (
                                <div className="line-actions">
                                  <button
                                    className="icon-button"
                                    aria-label={`Rediger ${line.name}`}
                                    onClick={() => openForm("", line)}
                                    disabled={busy || conflict}
                                  >
                                    <Pencil size={16} />
                                    <span className="edit-label">Endre</span>
                                  </button>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                  <aside
                    className="print-actions"
                    aria-label="Utskrift og lagring"
                  >
                    {trashed ? (
                      <div className="print-step">
                        <h3>I papirkurven</h3>
                        <p>
                          Varene er bevart. Gjenopprett lappen for å redigere
                          eller skrive ut.
                        </p>
                        <p>
                          Gjenopprett innen{" "}
                          <strong>
                            {dateLabel(osloDate(deletionDeadline(sheet)!))}
                          </strong>
                          .
                        </p>
                        <button
                          className="button primary"
                          onClick={() => action("restore")}
                          disabled={busy}
                        >
                          <Undo2 size={18} />
                          Gjenopprett lapp
                        </button>
                      </div>
                    ) : readOnly ? (
                      <div className="print-step">
                        <h3>
                          {stateLocked ? "Klar til utskrift" : "Ikke låst ennå"}
                        </h3>
                        <p>
                          {stateLocked
                            ? `Revisjon ${sheet.revision} brukes i PDF-en.`
                            : `${sheetCreator} må låse listen før den kan skrives ut.`}
                        </p>
                        {stateLocked && (
                          <button
                            className="button primary"
                            onClick={() => openPdf()}
                            disabled={busy}
                          >
                            <Printer size={18} />
                            {pdfState === "PDF klargjøres …"
                              ? pdfState
                              : "Åpne PDF"}
                          </button>
                        )}
                        <button
                          className="button secondary"
                          onClick={() => setPreview(!preview)}
                        >
                          {preview ? "Se varelinjer" : "Se utskrift"}
                        </button>
                      </div>
                    ) : preview ? (
                      <>
                        <div className="print-step">
                          <h3>
                            {locked
                              ? "1. Lappen er låst"
                              : "1. Kontroller og lås lappen"}
                          </h3>
                          <p>
                            {locked
                              ? `Revisjon ${sheet.revision} brukes i PDF-en.`
                              : "Kontroller varer og antall. Låsing sikrer at PDF-en bruker denne versjonen."}
                          </p>
                          {!locked && (
                            <button
                              className="button primary"
                              onClick={() => action("lock")}
                              disabled={
                                busy ||
                                conflict ||
                                !lineCount ||
                                Boolean(layoutError)
                              }
                            >
                              <LockKeyhole size={18} />
                              Lås lapp for utskrift
                            </button>
                          )}
                        </div>
                        <div className="print-step">
                          <h3>2. Åpne PDF og skriv ut</h3>
                          <p>
                            Velg A3 og faktisk størrelse (100 %) i
                            utskriftsdialogen.
                          </p>
                          <button
                            className={`button ${locked ? "primary" : "secondary"}`}
                            onClick={() => openPdf()}
                            disabled={!locked || busy || conflict || dirty}
                          >
                            <Printer size={18} />
                            {pdfState === "PDF klargjøres …"
                              ? pdfState
                              : "Åpne PDF"}
                          </button>
                          {pdfState && (
                            <p role="status" className="pdf-status">
                              {pdfState}
                            </p>
                          )}
                        </div>
                        {!foreign && (
                        <div className="print-step">
                          <h3>3. Bekreft etter utskrift</h3>
                          <p>
                            {sheet.delete_after
                              ? `Markert som skrevet ut. Slettes ${dateLabel(osloDate(new Date(sheet.delete_after)))}.`
                              : "Fristen på 7 dager før sletting starter først når du bekrefter."}
                          </p>
                          <button
                            className="button secondary"
                            onClick={() => action("printed")}
                            disabled={!locked || busy || !!sheet.printed_at}
                          >
                            <CheckCircle2 size={18} />
                            {sheet.printed_at
                              ? "Markert som skrevet ut"
                              : "Markér som skrevet ut"}
                          </button>
                        </div>
                        )}
                        {locked && (
                          <div className="print-step">
                            <button
                              className="button secondary"
                              onClick={() => action("reopen")}
                              disabled={busy}
                            >
                              <Pencil size={18} />
                              Åpne for redigering
                            </button>
                            <p>
                              Endringer krever ny låsing. En eventuell
                              slettefrist etter utskrift avbrytes.
                            </p>
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="count-footer">
                        <p>
                          <Info size={17} />{" "}
                          {locked
                            ? "Lappen er låst. Trykk Rediger for å endre den, eller Se utskrift for å skrive ut."
                            : "Endringene lagres automatisk på kontoen din."}
                        </p>
                        <button
                          className="button secondary"
                          onClick={() => {
                            setPreview(true);
                            setNotice("");
                          }}
                        >
                          <Printer size={18} />
                          Se utskrift
                          <ArrowRight size={17} />
                        </button>
                      </div>
                    )}
                  </aside>
                </div>
                {notice && (
                  <div className="success-banner" role="status">
                    <CheckCircle2 size={18} />
                    {notice}
                  </div>
                )}
              </>
            )}
          </section>
        </main>
      )}
      {scanner && (
        <Scanner
          onRead={read}
          onClose={() => setScanner(false)}
          onManual={() => openForm()}
        />
      )}
      {confirmation && (
        <Dialog labelledBy="confirm-title" onClose={() => answer(false)}>
          <section className="product-modal">
            <div className="modal-header">
              <h2 id="confirm-title">{confirmation.title}</h2>
            </div>
            <p className="dialog-description">{confirmation.text}</p>
            <div className="product-buttons">
              <button
                className="button secondary"
                autoFocus
                onClick={() => answer(false)}
              >
                Avbryt
              </button>
              <button className="button primary" onClick={() => answer(true)}>
                {confirmation.label}
              </button>
            </div>
          </section>
        </Dialog>
      )}
      {details && (
        <Dialog
          labelledBy="details-title"
          onClose={() => setDetails(null)}
          busy={busy}
        >
          <section className="product-modal">
            <div className="modal-header">
              <div>
                <span className="eyebrow">Lappedetaljer</span>
                <h2 id="details-title">Endre detaljer</h2>
              </div>
              <button
                className="icon-button"
                aria-label="Lukk detaljer"
                disabled={busy}
                onClick={() => setDetails(null)}
              >
                <X />
              </button>
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void saveDetails();
              }}
            >
              <label>
                Navn på lappen
                <input
                  autoFocus
                  maxLength={100}
                  value={details.title}
                  onChange={(e) =>
                    setDetails({ ...details, title: e.target.value })
                  }
                />
              </label>
              <label>
                Telledato
                <input
                  required
                  type="date"
                  value={details.date}
                  onChange={(e) =>
                    setDetails({ ...details, date: e.target.value })
                  }
                />
              </label>
              <label>
                <span className="field-label">
                  Plassering <em>Valgfritt</em>
                </span>
                <input
                  maxLength={120}
                  value={details.location}
                  onChange={(e) =>
                    setDetails({ ...details, location: e.target.value })
                  }
                />
              </label>
              {detailsError && (
                <p role="alert" className="form-error">
                  {detailsError}
                </p>
              )}
              <div className="product-buttons">
                <button
                  type="submit"
                  className="button primary"
                  disabled={busy || conflict}
                >
                  <Check size={18} />
                  {busy ? "Lagrer …" : "Lagre detaljer"}
                </button>
                <button
                  type="button"
                  className="button secondary"
                  disabled={busy}
                  onClick={() => setDetails(null)}
                >
                  Avbryt
                </button>
              </div>
            </form>
          </section>
        </Dialog>
      )}
      {batch && (
        <Dialog
          labelledBy="batch-title"
          onClose={() => setBatch(null)}
          busy={busy}
        >
          <section className="product-modal merge-modal">
            <div className="modal-header">
              <div>
                <span className="eyebrow">Skriv ut flere</span>
                <h2 id="batch-title">
                  {batch.done
                    ? `PDF klar · ${batch.pages} A3-ark`
                    : `${batchLines} ${batchLines === 1 ? "lapp" : "lapper"} i én PDF`}
                </h2>
              </div>
              <button
                className="icon-button"
                aria-label="Lukk utskrift"
                disabled={busy}
                onClick={() => setBatch(null)}
              >
                <X />
              </button>
            </div>
            <p className="dialog-description">
              {batch.done
                ? "Åpne PDF-en og velg A3 og faktisk størrelse (100 %). Har du skrevet ut? Bekreft under for å starte fristen på 7 dager før sletting."
                : batchDrafts
                  ? `${batchDrafts} utkast låses først, slik at PDF-en bruker denne versjonen. Du kan åpne dem for redigering igjen senere.`
                  : "Alle lappene er låst. Slettefristen starter ikke før du bekrefter utskriften."}
            </p>
            {batch.missing > 0 && (
              <p className="dialog-description">
                {batch.missing} produktbilde(r) kunne ikke hentes og mangler i
                PDF-en.
              </p>
            )}
            <div className="merge-preview-lines batch-lines">
              {batch.ids.map((id) => {
                const s = sheets.find((x) => x.id === id);
                if (!s) return null;
                return (
                  <div key={id}>
                    <span>
                      <strong>{sheetTitle(s.body)}</strong>
                      <small>
                        {s.body.lines.length ? sheetStatus(s) : "Tom – tas ikke med"}
                      </small>
                    </span>
                    <b>{s.body.lines.length}</b>
                  </div>
                );
              })}
            </div>
            {batch.progress && (
              <p className="dialog-description" role="status">
                <LoaderCircle size={15} className="spin" /> {batch.progress}
              </p>
            )}
            {batch.error && (
              <p className="form-error" role="alert">
                {batch.error}
              </p>
            )}
            <div className="product-buttons">
              {batch.done ? (
                <>
                  <button
                    className="button primary"
                    disabled={busy}
                    onClick={() =>
                      batchPdf.current &&
                      showPdf(
                        window.open("about:blank", "_blank"),
                        batchPdf.current.blob,
                        batchPdf.current.filename,
                      )
                    }
                  >
                    <Printer size={18} /> Åpne PDF
                  </button>
                  <button
                    className="button secondary"
                    disabled={busy}
                    onClick={markBatchPrinted}
                  >
                    <CheckCircle2 size={18} />
                    {busy ? "Markerer …" : "Markér alle som skrevet ut"}
                  </button>
                </>
              ) : (
                <button
                  className="button primary"
                  disabled={busy || !batchLines}
                  onClick={printBatch}
                >
                  <Printer size={18} />
                  {busy
                    ? "PDF klargjøres …"
                    : batchDrafts
                      ? "Lås utkast og lag PDF"
                      : "Lag PDF"}
                </button>
              )}
              <button
                className="button secondary"
                disabled={busy}
                onClick={() => setBatch(null)}
              >
                {batch.done ? "Lukk" : "Avbryt"}
              </button>
            </div>
          </section>
        </Dialog>
      )}
      {mergePreview && (
        <Dialog
          labelledBy="merge-title"
          onClose={() => setMergePreview(null)}
          busy={busy}
        >
          <section className="product-modal merge-modal">
            <div className="modal-header">
              <div>
                <span className="eyebrow">Kontroller sammenslåingen</span>
                <h2 id="merge-title">{mergeName.trim() || mergePreview.title}</h2>
              </div>
              <button
                className="icon-button"
                aria-label="Lukk sammenslåing"
                disabled={busy}
                onClick={() => setMergePreview(null)}
              >
                <X />
              </button>
            </div>
            <p className="dialog-description">
              Du får en ny liste. Originallistene beholdes uendret.
            </p>
            <label>
              Navn på den nye listen
              <input
                maxLength={100}
                disabled={busy}
                value={mergeName}
                onChange={(e) => setMergeName(e.target.value)}
              />
            </label>
            <div className="source-chips">
              {mergePreview.sources?.map((source, i) => (
                <span className="source-chip" key={source.id}>
                  <i style={{ background: sourceColor(i) }} />
                  {source.title}
                </span>
              ))}
            </div>
            <div className="merge-preview-lines batch-lines">
              {mergePreview.lines.map((line) => (
                <div key={line.id}>
                  <span>
                    <strong>{line.name}</strong>
                    <small>
                      {line.parts
                        ?.map(
                          (part) =>
                            `${mergePreview.sources![part.source].title}: ${part.quantity}`,
                        )
                        .join(" + ")}
                    </small>
                  </span>
                  <b>{line.quantity}</b>
                </div>
              ))}
            </div>
            <p className="dialog-description">
              {mergePreview.lines.length} unike varer
            </p>
            {mergeError && (
              <p className="form-error" role="alert">
                {mergeError}
              </p>
            )}
            <div className="product-buttons">
              <button
                className="button primary"
                disabled={busy}
                onClick={() => mergePicked(true)}
              >
                <Layers size={18} />
                {busy
                  ? "Slår sammen …"
                  : `Slå sammen ${mergePreview.sources?.length} lister`}
              </button>
              <button
                className="button secondary"
                disabled={busy}
                onClick={() => setMergePreview(null)}
              >
                Avbryt
              </button>
            </div>
          </section>
        </Dialog>
      )}
      {form && (
        <Dialog labelledBy="product-title" onClose={() => setForm(false)}>
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
                  aria-invalid={Boolean(
                    formError && /EAN|kontrollsiffer/.test(formError),
                  )}
                  aria-describedby={formError ? "product-error" : undefined}
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
                  className="button secondary lookup-retry"
                  type="button"
                  onClick={() => setLookupRetry((n) => n + 1)}
                >
                  Prøv produktoppslaget igjen
                </button>
              )}
              {lookupState === "found" && product && name !== product.name && (
                <button
                  className="button secondary lookup-retry"
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
                  aria-invalid={Boolean(
                    formError && /varenavn/.test(formError),
                  )}
                  aria-describedby={formError ? "product-error" : undefined}
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
                  aria-invalid={Boolean(
                    formError && /[Aa]ntall/.test(formError),
                  )}
                  aria-describedby={formError ? "product-error" : undefined}
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
                <p className="form-error" role="alert" id="product-error">
                  {formError}
                </p>
              )}
              {editId && (
                <button
                  type="button"
                  className="button danger-secondary"
                  onClick={() => {
                    const line = draft.lines.find((l) => l.id === editId);
                    if (line) remove(line);
                    setForm(false);
                  }}
                >
                  <Trash2 size={18} />
                  Fjern vare
                </button>
              )}
              <div className="product-buttons">
                {duplicate ? (
                  <>
                    <button
                      className="button primary"
                      type="button"
                      onClick={() => addLine("add")}
                    >
                      <Plus size={18} />{" "}
                      {/^\d+$/.test(qty) &&
                      Number.isSafeInteger(Number(qty) + duplicate.quantity)
                        ? `Legg til ${qty} → totalt ${Number(qty) + duplicate.quantity}`
                        : "Legg til antall"}
                    </button>
                    <button
                      className="button secondary"
                      type="button"
                      onClick={() => addLine("replace")}
                    >
                      {/^\d+$/.test(qty)
                        ? `Erstatt med ${qty}`
                        : "Erstatt antall"}
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
                className="button secondary cancel"
                type="button"
                onClick={() => setForm(false)}
              >
                Avbryt
              </button>
            </form>
          </section>
        </Dialog>
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
