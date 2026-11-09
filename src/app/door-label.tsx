"use client";
import { eanBits } from "@/lib/barcode";
import { validEan } from "@/lib/model";
import type { DoorDetails } from "@/lib/door-marking";
import type { Product } from "@/lib/products";
export function DoorLabel({
  ean,
  name,
  details,
  points,
  product,
  onImage,
}: {
  ean: string;
  name: string;
  details: DoorDetails;
  points: string[];
  product: Product | null;
  onImage: (url: string, state: "ready" | "missing") => void;
}) {
  return (
    <article className="door-label" aria-label={`Dørmerke ${ean || "utkast"}`}>
      <div className="door-label-kicker">DØRMERKING</div>
      <h2>{name || "Produktnavn"}</h2>
      <div className="door-image">
        {product?.imageUrl ? (
          <img
            key={product.imageUrl}
            src={product.imageUrl}
            alt={name}
            referrerPolicy="no-referrer"
            onLoad={() => onImage(product!.imageUrl!, "ready")}
            onError={() => onImage(product!.imageUrl!, "missing")}
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
}
