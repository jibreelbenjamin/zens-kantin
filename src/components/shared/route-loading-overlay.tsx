"use client";
import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Overlay layar penuh yang aktif PERSIS selama top loading bar (NextTopLoader)
 * tampil, supaya seluruh layar "static" (tidak bisa diklik apa pun) dan
 * opacity-nya turun (redup) selama transisi halaman — mencegah user
 * klik ganda / klik elemen lain saat halaman masih berpindah.
 *
 * NextTopLoader dibangun di atas library NProgress, yang menandai sedang
 * berjalan dengan menambahkan class `nprogress-busy` ke elemen <html> (dan
 * menghapusnya lagi begitu selesai). Overlay ini mengamati class tersebut
 * lewat MutationObserver — jadi statusnya selalu sinkron 1:1 dengan bar
 * loading di atas, tanpa perlu menduplikasi logika deteksi navigasi sendiri.
 */
export function RouteLoadingOverlay() {
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    const html = document.documentElement;

    function sync() {
      setLoading(html.classList.contains("nprogress-busy"));
    }

    sync();
    const observer = new MutationObserver(sync);
    observer.observe(html, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  return (
    <div
      aria-hidden={!loading}
      className={cn(
        "fixed inset-0 z-[9999] bg-background/60 transition-opacity duration-200",
        loading ? "opacity-100" : "pointer-events-none opacity-0"
      )}
    />
  );
}
