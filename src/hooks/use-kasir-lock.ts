"use client";
import * as React from "react";
import { useRouter, usePathname } from "next/navigation";
import { useIdleTimer } from "@/hooks/use-idle-timer";
import { KASIR_IDLE_LOCK_MS } from "@/lib/constants";

/**
 * Layar PIN kasir sekarang HALAMAN TERPISAH (/kasir/lock), digerbangi lewat
 * middleware yang mengecek cookie HttpOnly `kasir_unlocked` (lihat
 * src/middleware.ts & /api/kasir/verify-pin). Pendekatan lama menumpuk
 * <PinLockOverlay> di ATAS konten kasir yang sudah terlanjur ter-render di
 * belakangnya — lewat Inspect Element, overlay itu bisa dihapus/disembunyikan
 * dan konten (termasuk data pesanan pelanggan) langsung kelihatan. Sekarang
 * selama terkunci, halaman kasir yang sebenarnya TIDAK PERNAH ikut ter-render
 * sama sekali — jadi tidak ada apa pun untuk "dibongkar" lewat DevTools.
 *
 * Hook ini hanya menangani DUA hal di sisi kasir yang sudah terbuka:
 *   1. Idle timer — kalau tidak ada aktivitas selama interval yang admin
 *      atur, otomatis dikunci lagi (hapus cookie + pindah ke /kasir/lock).
 *   2. Tombol "Kunci layar sekarang" di header — sama persis, manual.
 */
export function useKasirLock() {
  const router = useRouter();
  const pathname = usePathname();
  const [lockMs, setLockMs] = React.useState(KASIR_IDLE_LOCK_MS);

  React.useEffect(() => {
    let cancelled = false;
    fetch("/api/kasir/lock-interval")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled || !data) return;
        const minutes = data.minutes;
        if (typeof minutes === "number" && minutes > 0) setLockMs(minutes * 60 * 1000);
      })
      .catch(() => {
        // Gagal ambil interval kustom — pakai default KASIR_IDLE_LOCK_MS, aman.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const lockNow = React.useCallback(() => {
    // Hapus cookie unlock DULU (biar tidak ada jendela waktu di mana
    // halaman ini masih "sah" diakses lewat refresh), baru pindah halaman.
    fetch("/api/kasir/lock", { method: "POST" }).finally(() => {
      router.push(`/kasir/lock?next=${encodeURIComponent(pathname)}`);
    });
  }, [router, pathname]);

  useIdleTimer(lockMs, lockNow, true);

  return { lockNow };
}
