"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger, DialogDescription, DialogClose } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Combobox } from "@/components/shared/combobox";
import { ImageUpload } from "@/components/shared/image-upload";
import { NumberInput } from "@/components/shared/number-input";
import { FormFieldset } from "@/components/shared/form-fieldset";
import { formatRupiah } from "@/lib/utils";

export function StokFormDialog({ products }: { products: { id: string; nama: string }[] }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [produkId, setProdukId] = React.useState("");
  const [totalBeli, setTotalBeli] = React.useState(0);
  const [qty, setQty] = React.useState(0);
  const [gambar, setGambar] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!open) {
      setProdukId(""); setTotalBeli(0); setQty(0); setGambar(null);
    }
  }, [open]);

  const hargaSatuan = qty > 0 ? Math.round((totalBeli / qty) * 100) / 100 : 0;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!produkId) {
      toast.error("Pilih produk terlebih dahulu.");
      return;
    }
    if (qty <= 0) {
      toast.error("Jumlah stok masuk harus lebih dari 0.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/stok", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ produk_id: produkId, total_beli: totalBeli, qty, gambar_url: gambar }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      toast.success("Stok ditambahkan.");
      setOpen(false);
      router.refresh();
    } catch (err: any) {
      toast.error("Gagal menyimpan", { description: err.message });
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4" /> Input Stok</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Input Stok Barang Masuk</DialogTitle>
          <DialogDescription>Masukkan total harga beli untuk seluruh stok yang masuk — modal per item dihitung otomatis.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <FormFieldset disabled={loading} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Produk</Label>
              <Combobox
                items={products.map((p) => ({ value: p.id, label: p.nama }))}
                value={produkId}
                onChange={setProdukId}
                placeholder="Pilih produk"
                searchPlaceholder="Cari produk..."
                emptyMessage="Produk tidak ditemukan."
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="qty">Jumlah stok masuk</Label>
                <NumberInput id="qty" min={0} value={qty} onChange={setQty} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="total-beli">Total harga beli (Rp)</Label>
                <NumberInput id="total-beli" min={0} value={totalBeli} onChange={setTotalBeli} />
              </div>
            </div>
            <p className="rounded-md bg-secondary/60 px-3 py-2 text-xs text-muted-foreground">
              Modal per item: <span className="font-medium text-foreground">{formatRupiah(hargaSatuan)}</span>
              {" "}({formatRupiah(totalBeli)} ÷ {qty || 0} item)
            </p>
            <ImageUpload value={gambar} onChange={setGambar} folder="stock" label="Struk belanja" optional />
          </FormFieldset>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline" disabled={loading}>Batal</Button>
            </DialogClose>
            <Button type="submit" disabled={loading}>{loading && <Loader2 className="h-4 w-4 animate-spin" />} Simpan</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
