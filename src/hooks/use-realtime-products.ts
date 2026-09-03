"use client";
import * as React from "react";

const POLL_MS = 4000;

/**
 * Data produk "realtime" untuk halaman pelanggan & kasir (foto, harga,
 * stok, status tampil) — supaya langsung terlihat begitu berubah tanpa
 * refresh, termasuk saat stok habis.
 *
 * Sebelumnya hook ini berlangganan channel realtime Supabase DAN polling
 * langsung ke `.from("products").select("*")` dari browser — dua-duanya
 * menembak Supabase langsung dari client, dan payload-nya membawa seluruh
 * kolom apa adanya (termasuk `modal`/harga pokok yang seharusnya tidak
 * pernah sampai ke pelanggan, walau nanti "disaring" di JS — datanya sudah
 * terlanjur lewat jaringan). Sekarang diganti polling ke endpoint sendiri
 * (`/api/produk-live`), yang di server menentukan kolom apa saja yang
 * boleh dikirim sesuai role pemanggil, dan selalu terurut abjad.
 */
export function useRealtimeProducts<T extends { id: string }>(initialProducts: T[]) {
  const [products, setProducts] = React.useState<T[]>(initialProducts);

  React.useEffect(() => {
    setProducts(initialProducts);
  }, [initialProducts]);

  React.useEffect(() => {
    let cancelled = false;

    async function refresh() {
      try {
        const res = await fetch("/api/produk-live");
        if (!res.ok) return;
        const json = await res.json();
        if (!cancelled && Array.isArray(json.products)) setProducts(json.products as T[]);
      } catch {
        // Koneksi sempat gagal — biarkan, coba lagi di interval berikutnya.
      }
    }

    refresh();
    const interval = setInterval(refresh, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  return products;
}
