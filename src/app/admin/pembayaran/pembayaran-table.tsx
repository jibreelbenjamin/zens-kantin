"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger, DialogDescription , DialogClose} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import type { PaymentMethod } from "@/types/database";
import { FormFieldset } from "@/components/shared/form-fieldset";
import { PaymentInfoDialog } from "./payment-info-dialog";

function AddDialog() {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [nama, setNama] = React.useState("");
  const [loading, setLoading] = React.useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/admin/pembayaran", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ nama }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      toast.success("Metode pembayaran ditambahkan.");
      setNama(""); setOpen(false); router.refresh();
    } catch (err: any) {
      toast.error("Gagal", { description: err.message });
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4" /> Tambah Metode</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Tambah Metode Pembayaran</DialogTitle>
          <DialogDescription>Contoh: Tunai, QRIS, Transfer Bank, e-Wallet.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <FormFieldset disabled={loading} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="nama">Nama</Label>
              <Input id="nama" value={nama} onChange={(e) => setNama(e.target.value)} required />
            </div>
          </FormFieldset>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline" disabled={loading}>Batal</Button>
            </DialogClose>
            <Button type="submit" disabled={loading}>{loading && <Loader2 className="h-4 w-4 animate-spin" />} Tambah</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Row({ item }: { item: PaymentMethod }) {
  const router = useRouter();
  const [loading, setLoading] = React.useState(false);
  const [deleteOpen, setDeleteOpen] = React.useState(false);

  async function toggleActive(is_active: boolean) {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/pembayaran/${item.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ is_active }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      router.refresh();
    } catch (err: any) {
      toast.error("Gagal", { description: err.message });
    } finally {
      setLoading(false);
    }
  }

  async function remove() {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/pembayaran/${item.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error((await res.json()).error);
      toast.success("Dihapus.");
      setDeleteOpen(false);
      router.refresh();
    } catch (err: any) {
      toast.error("Gagal menghapus", { description: err.message });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex items-center justify-between py-3">
      <div className="flex items-center gap-2.5">
        <span className="font-medium">{item.nama}</span>
        <Badge variant={item.is_active ? "success" : "secondary"}>{item.is_active ? "Aktif" : "Nonaktif"}</Badge>
        {item.tampilkan_info_pembayaran && <Badge variant="warning">Info pembayaran aktif</Badge>}
      </div>
      <div className="flex items-center gap-3">
        <Switch checked={item.is_active} onCheckedChange={toggleActive} disabled={loading} />
        <PaymentInfoDialog item={item} />
        <ConfirmDialog
          open={deleteOpen}
          onOpenChange={setDeleteOpen}
          trigger={
            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></Button>
          }
          title={`Hapus "${item.nama}"?`}
          description="Metode pembayaran ini tidak akan muncul lagi untuk pelanggan."
          confirmLabel="Ya, Hapus"
          destructive
          loading={loading}
          onConfirm={remove}
        />
      </div>
    </div>
  );
}

export function PembayaranTable({ data }: { data: PaymentMethod[] }) {
  return (
    <Card>
      <CardContent className="p-6">
        <div className="mb-3 flex justify-end"><AddDialog /></div>
        <div className="divide-y">
          {data.length ? data.map((item) => <Row key={item.id} item={item} />) : (
            <p className="py-8 text-center text-sm text-muted-foreground">Belum ada metode pembayaran.</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
