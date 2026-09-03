"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, Pencil, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger, DialogDescription, DialogClose,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { ImageUpload } from "@/components/shared/image-upload";
import { NumberInput } from "@/components/shared/number-input";
import { FormFieldset } from "@/components/shared/form-fieldset";
import { formatRupiah } from "@/lib/utils";
import type { Category, Product } from "@/types/database";

const NO_CATEGORY = "__none__";

export function ProductFormDialog({ product, categories = [] }: { product?: Product; categories?: Category[] }) {
  const router = useRouter();
  const isEdit = !!product;
  const [open, setOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [nama, setNama] = React.useState("");
  const [gambar, setGambar] = React.useState<string | null>(null);
  const [harga, setHarga] = React.useState(0);
  const [kategoriId, setKategoriId] = React.useState<string>(NO_CATEGORY);
  const [aktif, setAktif] = React.useState(true);

  // Sinkronkan ulang form dari data produk TERBARU setiap kali dialog dibuka —
  // bukan cuma sekali saat mount. Ini mencegah bug form menampilkan data lama
  // ketika baris tabel berpindah posisi (mis. setelah menambah produk baru).
  React.useEffect(() => {
    if (open) {
      setNama(product?.nama ?? "");
      setGambar(product?.gambar_url ?? null);
      setHarga(product?.harga_jual ?? 0);
      setKategoriId(product?.kategori_id ?? NO_CATEGORY);
      setAktif(product?.is_active ?? true);
    }
  }, [open, product]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const payload = {
        nama, gambar_url: gambar, harga_jual: harga, is_active: aktif,
        kategori_id: kategoriId === NO_CATEGORY ? null : kategoriId,
      };
      const res = await fetch(isEdit ? `/api/admin/produk/${product!.id}` : "/api/admin/produk", {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      toast.success(isEdit ? "Produk diperbarui." : "Produk ditambahkan. Tambahkan stok awal lewat menu Input Stok.");
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
      <DialogTrigger asChild>
        {isEdit ? (
          <Button variant="ghost" size="icon" className="h-8 w-8"><Pencil className="h-3.5 w-3.5" /></Button>
        ) : (
          <Button size="sm"><Plus className="h-4 w-4" /> Tambah Produk</Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? `Edit "${product?.nama}"` : "Tambah Produk"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Perbarui detail produk ini."
              : "Isi detail produk baru. Stok & modal diatur belakangan lewat menu Input Stok."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <FormFieldset disabled={loading} className="space-y-4">
            <ImageUpload value={gambar} onChange={setGambar} folder="products" label="Gambar produk" optional />
            <div className="space-y-1.5">
              <Label htmlFor="nama">Nama produk</Label>
              <Input id="nama" value={nama} onChange={(e) => setNama(e.target.value)} required />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="harga">Harga Jual (Rp)</Label>
                <NumberInput id="harga" min={0} value={harga} onChange={setHarga} />
              </div>
              <div className="space-y-1.5">
                <Label>Kategori</Label>
                <Select value={kategoriId} onValueChange={setKategoriId}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NO_CATEGORY}>Tanpa Kategori</SelectItem>
                    {categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.nama}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {isEdit ? (
              <p className="rounded-md bg-secondary/60 px-3 py-2 text-xs text-muted-foreground">
                Modal saat ini: <span className="font-medium text-foreground">{formatRupiah(product?.modal ?? 0)}</span> per item
                {" "}— dihitung otomatis dari menu <span className="font-medium text-foreground">Input Stok</span>, tidak bisa diisi manual di sini.
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">
                Produk baru dimulai dengan stok & modal 0. Tambahkan stok awal (sekaligus modalnya) lewat menu{" "}
                <span className="font-medium text-foreground">Input Stok</span> setelah ini tersimpan.
              </p>
            )}
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <p className="text-sm font-medium">Tampilkan ke pelanggan</p>
                <p className="text-xs text-muted-foreground">Nonaktifkan untuk sembunyikan sementara dari halaman pesan.</p>
              </div>
              <Switch checked={aktif} onCheckedChange={setAktif} />
            </div>
          </FormFieldset>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline" disabled={loading}>Batal</Button>
            </DialogClose>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              {isEdit ? "Simpan Perubahan" : "Tambah Produk"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
