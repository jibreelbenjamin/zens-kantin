"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, Pencil, Plus, Tags, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger, DialogDescription , DialogClose} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { FormFieldset } from "@/components/shared/form-fieldset";
import type { Category } from "@/types/database";

function CategoryFormDialog({ category, trigger }: { category?: Category; trigger: React.ReactNode }) {
  const router = useRouter();
  const isEdit = !!category;
  const [open, setOpen] = React.useState(false);
  const [nama, setNama] = React.useState("");
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    if (open) setNama(category?.nama ?? "");
  }, [open, category]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch(isEdit ? `/api/admin/kategori/${category!.id}` : "/api/admin/kategori", {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nama }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      toast.success(isEdit ? "Kategori diperbarui." : "Kategori ditambahkan.");
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
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Kategori" : "Tambah Kategori"}</DialogTitle>
          <DialogDescription>Contoh: Makanan, Minuman, Snack.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <FormFieldset disabled={loading} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="nama-kategori">Nama kategori</Label>
              <Input id="nama-kategori" value={nama} onChange={(e) => setNama(e.target.value)} required />
            </div>
          </FormFieldset>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline" disabled={loading}>Batal</Button>
            </DialogClose>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 animate-spin" />} {isEdit ? "Simpan" : "Tambah"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function CategoryRow({ category, count }: { category: Category; count: number }) {
  const router = useRouter();
  const [loading, setLoading] = React.useState(false);
  const [confirmOpen, setConfirmOpen] = React.useState(false);

  async function remove() {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/kategori/${category.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error((await res.json()).error);
      toast.success("Kategori dihapus.");
      setConfirmOpen(false);
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
        <span className="font-medium">{category.nama}</span>
        <Badge variant="secondary">{count} produk</Badge>
      </div>
      <div className="flex items-center gap-1">
        <CategoryFormDialog
          category={category}
          trigger={<Button variant="ghost" size="icon" className="h-8 w-8"><Pencil className="h-3.5 w-3.5" /></Button>}
        />
        <ConfirmDialog
          open={confirmOpen}
          onOpenChange={setConfirmOpen}
          trigger={<Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></Button>}
          title={`Hapus kategori "${category.nama}"?`}
          description={count > 0 ? `${count} produk di kategori ini akan jadi "Tanpa Kategori", produknya sendiri tidak terhapus.` : "Kategori ini tidak dipakai produk mana pun."}
          confirmLabel="Ya, Hapus"
          destructive
          loading={loading}
          onConfirm={remove}
        />
      </div>
    </div>
  );
}

export function KategoriTable({ categories, countByCategory }: { categories: Category[]; countByCategory: Record<string, number> }) {
  return (
    <Card>
      <CardContent className="p-6">
        <div className="mb-3 flex justify-end">
          <CategoryFormDialog trigger={<Button size="sm"><Plus className="h-4 w-4" /> Tambah Kategori</Button>} />
        </div>
        <div className="divide-y">
          {categories.length ? categories.map((c) => (
            <CategoryRow key={c.id} category={c} count={countByCategory[c.id] ?? 0} />
          )) : (
            <div className="flex flex-col items-center gap-2 py-10 text-center text-muted-foreground">
              <Tags className="h-6 w-6 opacity-50" />
              <p className="text-sm">Belum ada kategori.</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
