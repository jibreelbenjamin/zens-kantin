"use client";
import * as React from "react";

// Ini fallback PALING TERAKHIR — dipakai Next.js kalau root layout.tsx
// SENDIRI yang gagal (bukan cuma satu halaman), jadi wajib merender
// <html>/<body> sendiri (menggantikan layout.tsx sepenuhnya) dan sengaja
// tidak bergantung pada Tailwind/font/komponen apa pun dari aplikasi utama
// — semuanya inline supaya tetap tampil walau bagian lain gagal dimuat.
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  React.useEffect(() => {
    console.error("Error fatal tertangkap oleh global-error.tsx:", error);
  }, [error]);

  return (
    <html lang="id">
      <body style={{ margin: 0, fontFamily: "system-ui, sans-serif", background: "#f2f1ec", color: "#1c1c1a" }}>
        <div style={{ display: "flex", minHeight: "100vh", alignItems: "center", justifyContent: "center", padding: 24 }}>
          <div style={{ width: "100%", maxWidth: 380, textAlign: "center", background: "#fff", border: "1px solid #e5e3da", borderRadius: 14, padding: 32 }}>
            <div style={{
              margin: "0 auto 16px", display: "flex", height: 48, width: 48, alignItems: "center", justifyContent: "center",
              borderRadius: "9999px", background: "rgba(185, 45, 32, 0.12)", color: "#b92d20", fontSize: 24,
            }}>
              !
            </div>
            <h1 style={{ fontSize: 20, fontWeight: 600, margin: "0 0 8px" }}>Aplikasi Gagal Dimuat</h1>
            <p style={{ fontSize: 14, color: "#6b6a63", margin: "0 0 20px" }}>
              Maaf, terjadi kesalahan fatal. Coba muat ulang halaman ini.
            </p>
            <button
              onClick={reset}
              style={{
                width: "100%", padding: "10px 16px", borderRadius: 8, border: "none",
                background: "#1b4d3e", color: "#fff", fontSize: 14, fontWeight: 500, cursor: "pointer",
              }}
            >
              Coba Lagi
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
