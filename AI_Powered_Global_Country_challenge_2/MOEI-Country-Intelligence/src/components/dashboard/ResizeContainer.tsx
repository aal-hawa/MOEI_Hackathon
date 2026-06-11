'use client';

/* ───────────────────────────────────────────────────────────────
   MOEI Country Intelligence Platform – Resize Container
   Waits for the parent to have real dimensions before rendering
   children. Fixes Recharts -1 width/height warnings.
   ─────────────────────────────────────────────────────────────── */

import { useState, useEffect, useRef, type ReactNode } from 'react';

interface ResizeContainerProps {
  children: ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

export default function ResizeContainer({
  children,
  className,
  style,
}: ResizeContainerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [hasSize, setHasSize] = useState(false);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    let rafId: number;

    const check = () => {
      // Use getBoundingClientRect for more reliable measurement
      const { width, height } = el.getBoundingClientRect();
      if (width > 0 && height > 0) {
        setHasSize(true);
      } else {
        // Schedule another check after the next paint
        rafId = requestAnimationFrame(check);
      }
    };

    // Wait for the next frame (after paint) before checking dimensions
    rafId = requestAnimationFrame(() => {
      rafId = requestAnimationFrame(check);
    });

    // Also observe resize for future layout changes
    const observer = new ResizeObserver(() => {
      const { width, height } = el.getBoundingClientRect();
      if (width > 0 && height > 0) {
        setHasSize(true);
      }
    });
    observer.observe(el);

    return () => {
      cancelAnimationFrame(rafId);
      observer.disconnect();
    };
  }, []);

  return (
    <div ref={containerRef} className={className} style={style}>
      {hasSize ? children : null}
    </div>
  );
}
