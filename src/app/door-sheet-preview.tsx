"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";

/** Scale the same physical A4 layout used for printing to fit both screen width and height. */
export function DoorSheetPreview({ children }: { children: ReactNode }) {
  const container = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.5);
  useEffect(() => {
    const measure = () => {
      const width = container.current?.clientWidth || 320;
      const height = Math.max(300, window.innerHeight - 290);
      setScale(
        Math.min(width / ((210 * 96) / 25.4), height / ((297 * 96) / 25.4), 1),
      );
    };
    const observer = new ResizeObserver(measure);
    if (container.current) observer.observe(container.current);
    window.addEventListener("resize", measure);
    measure();
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, []);
  return (
    <div className="door-preview-stage" ref={container}>
      <div
        className="door-scaled-paper"
        style={{
          width: ((210 * 96) / 25.4) * scale,
          height: ((297 * 96) / 25.4) * scale,
        }}
      >
        <div className="door-sheet" style={{ transform: `scale(${scale})` }}>
          {children}
        </div>
      </div>
    </div>
  );
}
