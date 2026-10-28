"use client";
import { useEffect, useRef, useState } from "react";
import {
  X,
  Camera,
  SwitchCamera,
  Flashlight,
  ScanLine,
  ImagePlus,
  RotateCcw,
} from "lucide-react";
import { validEan } from "@/lib/model";
export function Scanner({
  onRead,
  onClose,
}: {
  onRead: (ean: string) => void;
  onClose: () => void;
}) {
  const video = useRef<HTMLVideoElement>(null),
    stream = useRef<MediaStream | null>(null),
    generation = useRef(0);
  const [status, setStatus] = useState("Hold strekkoden innenfor rammen.");
  const [error, setError] = useState(""),
    [ready, setReady] = useState(false),
    [devices, setDevices] = useState<MediaDeviceInfo[]>([]),
    [device, setDevice] = useState(""),
    [torch, setTorch] = useState(false),
    [supportsTorch, setSupportsTorch] = useState(false);
  const [supportsZoom, setSupportsZoom] = useState(false),
    [zoom, setZoom] = useState(1),
    [zoomMax, setZoomMax] = useState(1),
    [restart, setRestart] = useState(0);
  const readRef = useRef(onRead);
  readRef.current = onRead;
  useEffect(() => {
    const gen = ++generation.current;
    let timer: ReturnType<typeof setTimeout> | undefined,
      dead = false;
    let last = "",
      hits = 0;
    function stop() {
      dead = true;
      clearTimeout(timer);
      stream.current?.getTracks().forEach((t) => t.stop());
      stream.current = null;
      setReady(false);
    }
    const visibility = () => {
      if (document.hidden) {
        stop();
        setError("Kameraet er satt på pause. Start igjen når du er klar.");
      }
    };
    document.addEventListener("visibilitychange", visibility);
    async function start() {
      try {
        setError("");
        setStatus(
          "Tillat kamera i nettleseren. Kameraet starter når tilgangen er gitt.",
        );
        if (!navigator.mediaDevices?.getUserMedia)
          throw new Error(
            "Kamera krever HTTPS og en nettleser med kamerastøtte. Bruk manuell EAN som reserve.",
          );
        const module = import("zxing-wasm/reader");
        const media = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: device
            ? {
                deviceId: { exact: device },
                width: { ideal: 1920 },
                height: { ideal: 1080 },
              }
            : {
                facingMode: { ideal: "environment" },
                width: { ideal: 1920 },
                height: { ideal: 1080 },
              },
        });
        if (dead || generation.current !== gen) {
          media.getTracks().forEach((t) => t.stop());
          return;
        }
        stream.current = media;
        video.current!.srcObject = media;
        await video.current!.play();
        const zxing = await module;
        await zxing.prepareZXingModule({
          overrides: {
            locateFile: (path: string) =>
              path.endsWith(".wasm") ? "/merkelapp/zxing_reader.wasm" : path,
          },
          fireImmediately: true,
        });
        if (dead) return;
        setDevices(
          (await navigator.mediaDevices.enumerateDevices()).filter(
            (d) => d.kind === "videoinput",
          ),
        );
        const track = media.getVideoTracks()[0],
          caps = track.getCapabilities() as MediaTrackCapabilities & {
            torch?: boolean;
            zoom?: { min: number; max: number };
          };
        setSupportsTorch(Boolean(caps.torch));
        setTorch(false);
        setSupportsZoom(Boolean(caps.zoom));
        setZoomMax(caps.zoom?.max || 1);
        setZoom(caps.zoom?.min || 1);
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
        setReady(true);
        setStatus("Sikt på én strekkode.");
        async function tick() {
          if (dead || generation.current !== gen) return;
          try {
            const v = video.current;
            if (v && v.readyState >= 2) {
              const w = v.videoWidth,
                h = v.videoHeight,
                box = v.getBoundingClientRect();
              const scale = Math.max(box.width / w, box.height / h);
              const cw = Math.round((box.width / scale) * 0.86),
                ch = Math.round((box.height / scale) * 0.4);
              canvas.width = cw;
              canvas.height = ch;
              ctx.drawImage(
                v,
                (w - cw) / 2,
                (h - ch) / 2,
                cw,
                ch,
                0,
                0,
                cw,
                ch,
              );
              const results = await zxing.readBarcodes(
                ctx.getImageData(0, 0, cw, ch),
                {
                  formats: ["EAN-13", "EAN-8"],
                  tryHarder: true,
                  maxNumberOfSymbols: 1,
                },
              );
              if (dead) return;
              const ean = results[0]?.text;
              if (ean && validEan(ean)) {
                hits = ean === last ? hits + 1 : 1;
                last = ean;
                if (hits >= 2) {
                  setStatus("Kode lest");
                  navigator.vibrate?.(60);
                  stop();
                  readRef.current(ean);
                  return;
                }
              } else {
                last = "";
                hits = 0;
              }
            }
          } catch {
            setStatus("Flytt litt nærmere og hold telefonen rolig.");
          }
          if (!dead) timer = setTimeout(tick, 100);
        }
        void tick();
      } catch (e) {
        if (dead || generation.current !== gen) return;
        stop();
        setError(
          e instanceof DOMException && e.name === "NotAllowedError"
            ? "Kameratilgang mangler. Tillat kamera i nettleseren, eller skriv EAN manuelt."
            : e instanceof Error
              ? e.message
              : "Kunne ikke starte kamera.",
        );
      }
    }
    void start();
    return () => {
      generation.current++;
      stop();
      document.removeEventListener("visibilitychange", visibility);
    };
  }, [device, restart]);
  async function applyCamera(kind: "torch" | "zoom", value: boolean | number) {
    try {
      const track = stream.current?.getVideoTracks()[0];
      await track?.applyConstraints({
        advanced: [{ [kind]: value } as MediaTrackConstraintSet],
      });
      if (kind === "torch") setTorch(Boolean(value));
      else setZoom(Number(value));
    } catch {
      setStatus("Denne kamerainnstillingen støttes ikke av nettleseren.");
    }
  }
  async function fromPhoto(file: File | undefined) {
    if (!file) return;
    const gen = generation.current;
    try {
      const z = await import("zxing-wasm/reader");
      z.prepareZXingModule({
        overrides: {
          locateFile: (p: string) =>
            p.endsWith(".wasm") ? "/merkelapp/zxing_reader.wasm" : p,
        },
      });
      const r = await z.readBarcodes(file, {
        formats: ["EAN-13", "EAN-8"],
        tryHarder: true,
        maxNumberOfSymbols: 1,
      });
      if (generation.current !== gen) return;
      if (r[0] && validEan(r[0].text)) {
        generation.current++;
        stream.current?.getTracks().forEach((t) => t.stop());
        readRef.current(r[0].text);
      } else
        setError(
          "Fant ingen gyldig EAN i bildet. Prøv nærmere eller skriv inn koden manuelt.",
        );
    } catch {
      setError("Kunne ikke lese bildet.");
    }
  }
  return (
    <div
      className="modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="scan-title"
    >
      <section className="scan-modal">
        <div className="modal-header">
          <div>
            <span className="eyebrow">KAMERA</span>
            <h2 id="scan-title">Skann vare</h2>
          </div>
          <button
            className="icon-button"
            onClick={onClose}
            aria-label="Lukk skanner"
          >
            <X />
          </button>
        </div>
        <div className="camera-stage">
          <video ref={video} playsInline muted autoPlay />
          <div className={`scan-target ${ready ? "active" : ""}`}>
            <ScanLine size={40} />
          </div>
          <span className="camera-hint">EAN-13 / EAN-8</span>
        </div>
        <p className="scan-status" role="status">
          {error || status}
        </p>
        {error && (
          <button
            className="button primary"
            onClick={() => setRestart((n) => n + 1)}
          >
            <RotateCcw size={18} /> Start kamera igjen
          </button>
        )}
        <div className="camera-controls">
          {devices.length > 1 && (
            <label className="camera-select">
              <SwitchCamera size={18} />
              <select
                aria-label="Velg kamera"
                value={device}
                onChange={(e) => setDevice(e.target.value)}
              >
                <option value="">Automatisk bakkamera</option>
                {devices.map((d, i) => (
                  <option key={d.deviceId} value={d.deviceId}>
                    {d.label || `Kamera ${i + 1}`}
                  </option>
                ))}
              </select>
            </label>
          )}
          {supportsTorch && (
            <button
              className={`button ${torch ? "primary" : "secondary"}`}
              onClick={() => applyCamera("torch", !torch)}
            >
              <Flashlight size={18} /> Lys
            </button>
          )}
          {supportsZoom && (
            <label>
              Zoom{" "}
              <input
                aria-label="Zoom"
                type="range"
                min="1"
                max={Math.min(zoomMax, 4)}
                step=".1"
                value={zoom}
                onChange={(e) => applyCamera("zoom", +e.target.value)}
              />
            </label>
          )}
        </div>
        <div className="scan-footer">
          <label className="button secondary">
            <ImagePlus size={18} /> Les fra bilde
            <input
              type="file"
              accept="image/*"
              hidden
              onChange={(e) => fromPhoto(e.target.files?.[0])}
            />
          </label>
          <button className="text-button" onClick={onClose}>
            Skriv EAN manuelt
          </button>
        </div>
      </section>
    </div>
  );
}
