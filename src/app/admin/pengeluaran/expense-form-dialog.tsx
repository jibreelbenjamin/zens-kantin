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
import { Textarea } from "@/components/ui/textarea";
import { ImageUpload } from "@/components/shared/image-upload";
import { NumberInput } from "@/components/shared/number-input";
import { FormFieldset } from "@/components/shared/form-fieldset";
import type { Expense } from "@/types/database";

export function ExpenseFormDialog({ expense }: { expense?: Expense }) {
  const router = useRouter();
  const isEdit = !!expense;
  const [open, setOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [nama, setNama] = React.useState("");
  const [nominal, setNominal] = React.useState(0);
  const [keterangan, setKeterangan] = React.useState("");
  const [gambar, setGambar] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (open) {
      setNama(expense?.nama ?? "");
      setNominal(expense?.nominal ?? 0);
      setKeterangan(expense?.keterangan ?? "");
      setGambar(expense?.gambar_url ?? null);
    }
  }, [open, expense]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const payload = { nama, nominal, keterangan: keterangan || null, gambar_url: gambar };
      const res = await fetch(isEdit ? `/api/admin/pengeluaran/${expense!.id}` : "/api/admin/pengeluaran", {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      toast.success(isEdit ? "Pengeluaran khusus diperbarui." : "Pengeluaran khusus dicatat.");
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
          <Button size="sm"><Plus className="h-4 w-4" /> Catat Pengeluaran Khusus</Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Pengeluaran Khusus" : "Catat Pengeluaran Khusus"}</DialogTitle>
          <DialogDescription>Contoh: beli gas, isi galon, bayar listrik.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <FormFieldset disabled={loading} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="nama-pengeluaran">Nama pengeluaran</Label>
              <Input id="nama-pengeluaran" placeholder="cth. Isi ulang gas 3kg" value={nama} onChange={(e) => setNama(e.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="nominal">Nominal (Rp)</Label>
              <NumberInput id="nominal" min={0} value={nominal} onChange={setNominal} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="keterangan">Keterangan (opsional)</Label>
              <Textarea id="keterangan" value={keterangan} onChange={(e) => setKeterangan(e.target.value)} rows={2} />
            </div>
            <ImageUpload value={gambar} onChange={setGambar} folder="stock" label="Struk / bukti (opsional)" optional />
          </FormFieldset>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline" disabled={loading}>Batal</Button>
            </DialogClose>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              {isEdit ? "Simpan Perubahan" : "Simpan"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
