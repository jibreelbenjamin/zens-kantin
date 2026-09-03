"use client";
import * as React from "react";
import { CheckCircle2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger, DialogDescription, DialogClose,
} from "@/components/ui/dialog";
import { ImageUpload } from "@/components/shared/image-upload";
import { FormFieldset } from "@/components/shared/form-fieldset";
import { formatRupiah } from "@/lib/utils";
import type { Order } from "@/types/database";

/** Konfirmasi SEMUA pesanan dalam satu kelompok (group_id) sekaligus. */
export function ConfirmPaymentDialog({ orders, onConfirmed }: { orders: Order[]; onConfirmed: (updated: Order[]) => void }) {
  const [open, setOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [bukti, setBukti] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!open) setBukti(null);
  }, [open]);

  const total = orders.reduce((s, o) => s + o.harga_total, 0);
  const namaPemesan = orders[0]?.nama_pemesan ?? "";

  async function confirm() {
    setLoading(true);
    try {
      const res = await fetch("/api/orders/confirm-batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ order_ids: orders.map((o) => o.id), bukti_bayar_url: bukti }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Gagal mengonfirmasi.");
      toast.success(`Pesanan ${namaPemesan} ditandai lunas.`);
      setOpen(false);
      onConfirmed((json.orders ?? []) as Order[]);
    } catch (err: any) {
      toast.error("Gagal mengonfirmasi", { description: err.message });
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm"><CheckCircle2 className="h-3.5 w-3.5" /> Sudah Bayar</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Konfirmasi Pembayaran</DialogTitle>
          <DialogDescription>{namaPemesan}</DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5 rounded-lg border p-3">
          {orders.map((o) => (
            <div key={o.id} className="flex items-center justify-between text-sm">
              <span>{o.nama_produk} <span className="text-muted-foreground">×{o.qty}</span></span>
              <span className="tabular-figures">{formatRupiah(o.harga_total)}</span>
            </div>
          ))}
          <div className="flex items-center justify-between border-t pt-1.5 text-sm font-semibold">
            <span>Total</span>
            <span className="tabular-figures">{formatRupiah(total)}</span>
          </div>
        </div>
        <FormFieldset disabled={loading}>
          <ImageUpload value={bukti} onChange={setBukti} folder="orders" label="Bukti pembayaran (mis. screenshot QRIS)" optional />
        </FormFieldset>
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline" disabled={loading}>Batal</Button>
          </DialogClose>
          <Button onClick={confirm} disabled={loading}>
            {loading && <Loader2 className="h-4 w-4 animate-spin" />} Tandai Lunas
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
