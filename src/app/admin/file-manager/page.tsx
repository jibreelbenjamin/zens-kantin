import { listStorage } from "@/lib/file-manager";
import { FileManagerClient } from "./file-manager-client";

export default async function FileManagerPage() {
  // Render pertama langsung panggil listStorage() di server (bukan fetch
  // ke API route sendiri) — halaman ini sudah dibungkus AdminLayout yang
  // memverifikasi role admin, jadi aman. Navigasi folder SELANJUTNYA (klik
  // folder lain) baru lewat API route dari client.
  const initial = await listStorage("");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold">File Manager</h1>
        <p className="text-sm text-muted-foreground">
          Jelajahi penyimpanan aplikasi (foto produk, pesanan, stok, & pembayaran) — khusus lihat, tidak bisa unggah, ubah, atau hapus.
        </p>
      </div>
      <FileManagerClient initial={"error" in initial ? null : initial} />
    </div>
  );
}
