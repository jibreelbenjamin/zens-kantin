"use client";
import * as React from "react";

/**
 * Memantau aktivitas user (mouse, touch, keyboard, scroll, klik). Memanggil
 * onIdle setelah tidak ada aktivitas selama `timeoutMs`. Dipakai kasir untuk
 * mengunci layar dengan PIN setelah beberapa menit tanpa aktivitas.
 */
export function useIdleTimer(timeoutMs: number, onIdle: () => void, active = true) {
  const timerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const onIdleRef = React.useRef(onIdle);
  onIdleRef.current = onIdle;

  React.useEffect(() => {
    if (!active) return;

    const reset = () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => onIdleRef.current(), timeoutMs);
    };

    const events = ["mousemove", "mousedown", "keydown", "touchstart", "scroll", "click"];
    events.forEach((ev) => window.addEventListener(ev, reset, { passive: true }));
    reset();

    return () => {
      events.forEach((ev) => window.removeEventListener(ev, reset));
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [timeoutMs, active]);
}
