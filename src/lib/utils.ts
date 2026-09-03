import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatRupiah(value: number | null | undefined) {
  // CATATAN: sebelumnya pakai Intl.NumberFormat({ style: "currency", currency: "IDR" }),
  // tapi hasilnya bisa beda antara server (Node.js) & browser — ada yang menaruh spasi
  // setelah "Rp" ("Rp 5.000") dan ada yang tidak ("Rp5.000") tergantung versi data ICU
  // yang terpasang. Beda output SSR vs client ini yang memicu hydration error React.
  // Format manual (angka biasa + prefix "Rp " tetap) supaya hasilnya selalu identik
  // di server maupun client.
  const n = Math.round(value ?? 0);
  const formatted = new Intl.NumberFormat("id-ID", {
    maximumFractionDigits: 0,
  }).format(Math.abs(n));
  return `${n < 0 ? "-" : ""}Rp ${formatted}`;
}

export function formatDate(date: string | Date, withTime = false) {
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}),
  }).format(d);
}

export function formatBytes(bytes: number) {
  if (!Number.isFinite(bytes) || bytes < 0) return "-";
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  const value = bytes / Math.pow(1024, i);
  return `${i === 0 ? value : value.toFixed(value < 10 ? 2 : 1)} ${units[i]}`;
}

export function slugifyUsername(input: string) {
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9_]/g, "")
    .slice(0, 24);
}

/** Slug lowercase-berstrip buat nama file unduhan (mis. "Kantin Merdeka" -> "kantin-merdeka"). */
export function slugifyFilename(input: string) {
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "laporan";
}

export function isValidUsername(input: string) {
  // Hanya huruf kecil, angka, underscore. 3-24 karakter. Tanpa karakter spesial.
  return /^[a-z0-9_]{3,24}$/.test(input);
}

/**
 * Taruh produk yang stoknya habis di paling bawah, tanpa mengacak urutan
 * lain (mis. abjad dari query, atau urutan pencarian) — sort stabil, cuma
 * memisahkan "habis" vs "masih ada" jadi dua kelompok berurutan.
 */
export function sortStockAware<T extends { stok: number }>(products: T[]): T[] {
  return [...products].sort((a, b) => (a.stok === 0 ? 1 : 0) - (b.stok === 0 ? 1 : 0));
}

/**
 * Bikin ID unik (format UUID v4) buat nama file dsb, TANPA bergantung
 * penuh pada `crypto.randomUUID()` — method itu cuma tersedia di browser
 * modern & "secure context" (HTTPS/localhost), jadi bisa hilang begitu
 * saja di sebagian browser lama atau saat diakses lewat HTTP biasa (mis.
 * IP lokal jaringan kantin tanpa SSL). Berlapis 3:
 *  1. crypto.randomUUID()      — dipakai kalau ada (paling standar)
 *  2. crypto.getRandomValues() — dukungannya jauh lebih luas (tidak
 *                                 dibatasi secure context), dipakai untuk
 *                                 rakit UUID v4 manual kalau #1 tidak ada
 *  3. Math.random()            — jaring pengaman terakhir kalau `crypto`
 *                                 sama sekali tidak ada; tidak
 *                                 cryptographically secure, tapi cukup
 *                                 untuk sekadar nama file unik (bukan
 *                                 untuk keperluan keamanan/token).
 */
export function generateId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    try {
      return crypto.randomUUID();
    } catch {
      // Lanjut ke fallback di bawah (mis. gagal karena bukan secure context).
    }
  }
  if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
    const bytes = crypto.getRandomValues(new Uint8Array(16));
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0"));
    return `${hex.slice(0, 4).join("")}-${hex.slice(4, 6).join("")}-${hex.slice(6, 8).join("")}-${hex.slice(8, 10).join("")}-${hex.slice(10, 16).join("")}`;
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function initialsFromName(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

/** Unduh gambar (mis. bukti bayar / struk) sebagai file ke perangkat. */
export async function downloadImage(url: string, filename: string) {
  const res = await fetch(url);
  const blob = await res.blob();
  const blobUrl = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = blobUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(blobUrl);
}
