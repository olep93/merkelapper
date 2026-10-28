"use client";
import { useEffect, useState } from "react";
import { Tag } from "lucide-react";
export function ProductPhoto({
  src,
  name,
  large = false,
}: {
  src?: string;
  name: string;
  large?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [src]);
  let allowed = false;
  try {
    const u = new URL(src || "");
    allowed =
      u.origin === "https://www.obsbygg.no" &&
      !u.username &&
      !u.password &&
      /^\/globalassets\/(?:productimages|bilder|produktbilder)\/[^?#]+\.(?:jpe?g|png|webp)$/i.test(
        u.pathname,
      );
  } catch {}
  return (
    <span className={`product-photo ${large ? "large" : ""}`}>
      {allowed && !failed ? (
        <img
          src={src}
          alt={name}
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
        />
      ) : (
        <Tag size={large ? 30 : 20} aria-label="Produktbilde mangler" />
      )}
    </span>
  );
}
