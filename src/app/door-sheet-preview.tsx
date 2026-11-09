"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";

/** Scale the same physical A4 layout used for printing to fit both screen width and height. */
export function DoorSheetPreview({ children }: { children: ReactNode }) {
  const container = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.5);
  useEffect(() => {
    const measure = () => {
      const width = container.current?.clientWidth || 320;
      const top = container.current?.getBoundingClientRect().top || 0;
      const height =
        window.innerWidth > 760
          ? Math.max(220, window.innerHeight - Math.max(0, top) - 90)
          : Math.max(280, window.innerHeight - 220);
      setScale(
        Math.min(width / ((210 * 96) / 25.4), height / ((297 * 96) / 25.4), 1),
      );
    };
    const observer = new ResizeObserver(measure);
    if (container.current) {
      observer.observe(container.current);
      const workspace = container.current.closest(".door-workspace");
      if (workspace) observer.observe(workspace);
    }
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
