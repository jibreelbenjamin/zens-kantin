import type { Metadata } from "next";
import localFont from "next/font/local";
import NextTopLoader from "nextjs-toploader";
import { Analytics } from "@vercel/analytics/next";
import { Toaster } from "@/components/ui/sonner";
import { RouteLoadingOverlay } from "@/components/shared/route-loading-overlay";
import { APP_NAME } from "@/lib/constants";
import "./globals.css";

// PENTING (v19): font di-hosting sendiri lewat next/font/local (berkas .ttf
// di src/fonts/), BUKAN lagi next/font/google. Sebelumnya (Plus_Jakarta_Sans,
// Inter, IBM_Plex_Mono dari "next/font/google") next dev/build MEWAJIBKAN
// koneksi keluar ke fonts.googleapis.com/fonts.gstatic.com setiap kali
// layout.tsx dikompilasi ulang — di jaringan yang memblokir/tidak bisa
// menjangkau domain itu (proxy kantor, firewall, sebagian ISP/sekolah),
// kompilasi layout.tsx (dipakai SEMUA halaman) langsung gagal total dengan
// NextFontError, dan itulah akar masalah dari bug "Missing required error
// components, refreshing..." yang terus muncul walau sudah hard refresh —
// bukan reset sebentar, tapi kegagalan kompilasi yang berulang terus
// menerus selama jaringan ke Google Fonts tidak bisa diakses. Sekarang
// berkas fontnya ikut dibundel di repo (src/fonts/, lisensi OFL disertakan
// per keluarga font) jadi kompilasi 100% tidak butuh jaringan sama sekali.
const display = localFont({
  src: "../fonts/plus-jakarta-sans/PlusJakartaSans.ttf",
  variable: "--font-display",
  weight: "500 800",
  display: "swap",
});
const body = localFont({
  src: "../fonts/inter/Inter.ttf",
  variable: "--font-body",
  weight: "100 900",
  display: "swap",
});
const mono = localFont({
  src: [
    { path: "../fonts/ibm-plex-mono/IBMPlexMono-Regular.ttf", weight: "400", style: "normal" },
    { path: "../fonts/ibm-plex-mono/IBMPlexMono-Medium.ttf", weight: "500", style: "normal" },
    { path: "../fonts/ibm-plex-mono/IBMPlexMono-SemiBold.ttf", weight: "600", style: "normal" },
  ],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: APP_NAME,
  description: "Aplikasi manajemen kantin & kasir sederhana",
  // Favicon pakai file svg yang sama dengan brand mark di sidebar/tempat lain
  // (public/icon.svg) — satu sumber, bukan lagi konvensi otomatis app/icon.svg.
  icons: {
    icon: "/icon.svg",
    shortcut: "/icon.svg",
    apple: "/icon.svg",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <body className={`${display.variable} ${body.variable} ${mono.variable} font-sans`}>
        {/* zIndex dinaikkan di atas RouteLoadingOverlay (z-[9999]) — sebelumnya
            default nextjs-toploader (1600) tertutup overlay itu sendiri,
            jadi bar loading di atas tidak kelihatan sama sekali saat berpindah halaman. */}
        <NextTopLoader color="#1B4D3E" height={3} showSpinner={false} zIndex={10000} />
        <RouteLoadingOverlay />
        {children}
        <Toaster position="top-center" richColors />
        {/* Vercel Web Analytics — hanya mengirim data kunjungan halaman
            (tanpa cookie & tanpa identitas pengguna) dan cuma aktif kalau
            aplikasinya di-deploy di Vercel dengan Analytics dinyalakan; di
            lingkungan lain komponen ini tidak melakukan apa-apa. */}
        <Analytics />
      </body>
    </html>
  );
}
