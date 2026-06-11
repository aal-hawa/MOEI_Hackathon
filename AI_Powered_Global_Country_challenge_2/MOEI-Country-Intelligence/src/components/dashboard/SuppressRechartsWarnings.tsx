'use client';

/* ───────────────────────────────────────────────────────────────
   MOEI Country Intelligence Platform – Suppress Recharts Warnings
   Suppresses the known Recharts -1 dimension warning that fires
   before browser paint. Charts render correctly despite this.
   ─────────────────────────────────────────────────────────────── */

import { useEffect } from 'react';

export default function SuppressRechartsWarnings() {
  useEffect(() => {
    const origWarn = console.warn;
    console.warn = function (...args: unknown[]) {
      if (
        typeof args[0] === 'string' &&
        args[0].includes('width') &&
        args[0].includes('height') &&
        args[0].includes('chart')
      ) {
        return; // suppress Recharts -1 dimension warning
      }
      origWarn.apply(console, args);
    };

    return () => {
      console.warn = origWarn;
    };
  }, []);

  return null;
}
