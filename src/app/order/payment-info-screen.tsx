"use client";
import * as React from "react";
import { CheckCircle2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { StorageImage } from "@/components/shared/storage-image";
import { formatRupiah } from "@/lib/utils";
import type { PaymentMethod } from "@/types/database";

const AUTO_RETURN_MS = 5000;

type Phase = "info" | "done";

/**
 * Ditampilkan setelah pesanan terkirim, SEBELUM pesanan benar-benar
 * selesai — kalau admin mengaktifkan "tampilkan informasi pembayaran ke
 * pelanggan" untuk metode pembayaran yang dipilih.
 *
 * Pelanggan TIDAK perlu menunggu kasir benar-benar mengonfirmasi
 * pembayaran secara real-time — begitu pelanggan menekan "Saya Sudah
 * Membayar" (klaim, opsional, sekadar penanda buat kasir) atau "Bayar
 * Nanti" (langsung bayar di kasir), pesanan langsung dianggap dibuat.
 * Kasir tetap bisa memproses/mengonfirmasi pembayarannya belakangan dari
 * sisi kasir (pesanan tetap masuk sebagai "pending" di antrian kasir).
 */
export function PaymentInfoScreen({
  groupId, method, total, onDone,
}: { groupId: string; method: PaymentMethod; total: number; onDone: () => void }) {
  const [phase, setPhase] = React.useState<Phase>("info");
  const [claiming, setClaiming] = React.useState(false);
  const [secondsLeft, setSecondsLeft] = React.useState(5);

  // onDone disimpan di ref (bukan langsung di dependency array efek di
  // bawah) supaya timer TIDAK ikut ke-reset kalau parent (OrderPageClient)
  // re-render gara-gara polling produk tiap ~4 detik (useRealtimeProducts)
  // — sebelumnya ini bikin auto-return "Bayar Nanti"/"Pesan Lagi" nyaris
  // tidak pernah sempat jalan karena timer-nya keburu dibuat ulang dari
  // awal sebelum genap 5 detik.
  const onDoneRef = React.useRef(onDone);
  React.useEffect(() => {
    onDoneRef.current = onDone;
  }, [onDone]);

  React.useEffect(() => {
    if (phase !== "done") return;
    const interval = setInterval(() => setSecondsLeft((s) => Math.max(0, s - 1)), 1000);
    const timeout = setTimeout(() => onDoneRef.current(), AUTO_RETURN_MS);
    return () => { clearInterval(interval); clearTimeout(timeout); };
  }, [phase]);

  // Klaim "sudah bayar" — hanya penanda buat kasir (lihat confirm-paid
  // API), TIDAK menunggu kasir merespons balik. Begitu request selesai
  // (berhasil), langsung lanjut ke layar "pesanan sudah dibuat".
  async function claimPaid() {
    setClaiming(true);
    try {
      const res = await fetch("/api/orders/confirm-paid", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ group_id: groupId }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Gagal mengirim konfirmasi.");
      setPhase("done");
    } catch (err: any) {
      toast.error("Gagal mengirim konfirmasi", { description: err.message });
    } finally {
      setClaiming(false);
    }
  }

  if (phase === "done") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-secondary/30 p-6 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-success/15 text-success">
          <CheckCircle2 className="h-8 w-8" />
        </div>
        <h1 className="font-display text-2xl font-semibold">Pesanan sudah dibuat!</h1>
        <p className="max-w-xs text-sm text-muted-foreground">
          Pesanan kamu sudah masuk ke kasir. Silakan tunggu dipanggil atau tunjukkan struk ke kasir.
        </p>
        <Button onClick={onDone}>Pesan Lagi ({secondsLeft})</Button>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-secondary/30 p-6 text-center">
      <h1 className="font-display text-xl font-semibold">Selesaikan Pembayaran</h1>
      <p className="tabular-figures text-3xl font-bold text-primary">{formatRupiah(total)}</p>
      <p className="text-sm text-muted-foreground">via {method.nama}</p>

      <div className="w-full max-w-sm space-y-4 rounded-2xl border bg-card p-5 text-left shadow-sm">
        {method.tampilkan_gambar && method.info_gambar_url && (
          <div className="relative mx-auto aspect-square w-full max-w-[240px] overflow-hidden rounded-xl border bg-white">
            <StorageImage src={method.info_gambar_url} alt={`Info pembayaran ${method.nama}`} fill sizes="240px" className="object-contain" />
          </div>
        )}
        {method.tampilkan_teks && method.info_teks && (
          <p className="whitespace-pre-line text-sm text-foreground">{method.info_teks}</p>
        )}
      </div>

      <div className="w-full max-w-sm space-y-2">
        <Button size="lg" className="w-full" disabled={claiming} onClick={claimPaid}>
          {claiming && <Loader2 className="h-4 w-4 animate-spin" />} Saya Sudah Membayar
        </Button>
        <Button size="lg" variant="outline" className="w-full" disabled={claiming} onClick={() => setPhase("done")}>
          Bayar Nanti
        </Button>
      </div>
      <p className="max-w-xs text-xs text-muted-foreground">
        Tekan &quot;Saya Sudah Membayar&quot; kalau sudah transfer/bayar sekarang, atau &quot;Bayar Nanti&quot; kalau mau bayar langsung ke kasir.
      </p>
    </div>
  );
}
