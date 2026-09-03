"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger, DialogDescription, DialogClose } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Combobox } from "@/components/shared/combobox";
import { Textarea } from "@/components/ui/textarea";
import { NumberInput } from "@/components/shared/number-input";
import { FormFieldset } from "@/components/shared/form-fieldset";

export function WriteoffFormDialog({ products }: { products: { id: string; nama: string; modal: number; stok: number }[] }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [produkId, setProdukId] = React.useState("");
  const [qty, setQty] = React.useState(0);
  const [keterangan, setKeterangan] = React.useState("");

  React.useEffect(() => {
    if (!open) {
      setProdukId(""); setQty(0); setKeterangan("");
    }
  }, [open]);

  const selectedProduct = products.find((p) => p.id === produkId);
  const melebihiStok = !!selectedProduct && qty > selectedProduct.stok;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!produkId) {
      toast.error("Pilih produk terlebih dahulu.");
      return;
    }
    if (qty <= 0) {
      toast.error("Jumlah harus lebih dari 0.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/stok/writeoff", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ produk_id: produkId, qty, keterangan }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      toast.success("Stok dihapus.");
      setOpen(false);
      router.refresh();
    } catch (err: any) {
      toast.error("Gagal menghapus stok", { description: err.message });
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="text-destructive hover:text-destructive">
          <Trash2 className="h-4 w-4" /> Hapus Stok
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-warning" /> Penghapusan Stok</DialogTitle>
          <DialogDescription>
            Untuk barang rusak, hilang, atau kadaluarsa — hanya mengurangi jumlah stok. Kerugiannya sudah
            terhitung penuh saat stok ini pertama kali diinput, jadi tidak ada perhitungan kerugian lagi di sini.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <FormFieldset disabled={loading} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Produk</Label>
              <Combobox
                items={products.map((p) => ({ value: p.id, label: p.nama, meta: `stok ${p.stok}` }))}
                value={produkId}
                onChange={setProdukId}
                placeholder="Pilih produk"
                searchPlaceholder="Cari produk..."
                emptyMessage="Produk tidak ditemukan."
              />
              {selectedProduct && (
                <div className="flex items-center gap-1.5 pt-0.5">
                  <span className="text-xs text-muted-foreground">Stok saat ini:</span>
                  <Badge variant={selectedProduct.stok === 0 ? "destructive" : "secondary"}>{selectedProduct.stok}</Badge>
                </div>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="writeoff-qty">Jumlah dihapus</Label>
              <NumberInput id="writeoff-qty" min={0} value={qty} onChange={setQty} />
              {melebihiStok && <p className="text-xs font-medium text-destructive">Melebihi stok yang tersedia ({selectedProduct?.stok}).</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="writeoff-note">Keterangan (opsional)</Label>
              <Textarea id="writeoff-note" value={keterangan} onChange={(e) => setKeterangan(e.target.value)} rows={2} placeholder="cth. kemasan rusak, kadaluarsa" />
            </div>
          </FormFieldset>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline" disabled={loading}>Batal</Button>
            </DialogClose>
            <Button type="submit" variant="destructive" disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 animate-spin" />} Hapus Stok
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
