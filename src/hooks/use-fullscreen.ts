"use client";
import * as React from "react";

/** Kontrol Fullscreen API browser, dipakai halaman pelanggan & kasir (tablet kiosk). */
export function useFullscreen() {
  const [isFullscreen, setIsFullscreen] = React.useState(false);

  React.useEffect(() => {
    const onChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onChange);
    onChange();
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  const enter = React.useCallback(async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
      }
    } catch {
      // Diam-diam gagal (mis. browser menolak tanpa gestur user) — bukan error fatal.
    }
  }, []);

  const exit = React.useCallback(async () => {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      }
    } catch {
      // ignore
    }
  }, []);

  const toggle = React.useCallback(() => {
    if (document.fullscreenElement) exit();
    else enter();
  }, [enter, exit]);

  return { isFullscreen, enter, exit, toggle };
}

/**
 * Masuk fullscreen otomatis begitu pengguna melakukan interaksi PERTAMA
 * di halaman (klik/sentuh) — tanpa perlu tombol fullscreen terpisah,
 * karena browser mewajibkan gestur user untuk mengizinkan fullscreen.
 */
export function useAutoFullscreenOnFirstInteraction(enabled: boolean) {
  const { enter } = useFullscreen();

  React.useEffect(() => {
    if (!enabled) return;
    let done = false;
    const handler = () => {
      if (done) return;
      done = true;
      enter();
      window.removeEventListener("click", handler);
      window.removeEventListener("touchstart", handler);
    };
    window.addEventListener("click", handler);
    window.addEventListener("touchstart", handler);
    return () => {
      window.removeEventListener("click", handler);
      window.removeEventListener("touchstart", handler);
    };
  }, [enabled, enter]);
}
