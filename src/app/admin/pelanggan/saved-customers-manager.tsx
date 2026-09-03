"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus, Trash2, Users } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { FormFieldset } from "@/components/shared/form-fieldset";
import type { SavedCustomer } from "@/types/database";

export function SavedCustomersManager({ customers }: { customers: SavedCustomer[] }) {
  const router = useRouter();
  const [nama, setNama] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [deletingId, setDeletingId] = React.useState<string | null>(null);
  const [confirmTarget, setConfirmTarget] = React.useState<SavedCustomer | null>(null);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!nama.trim()) return;
    setLoading(true);
    try {
      const res = await fetch("/api/pelanggan", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ nama }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      toast.success("Nama ditambahkan.");
      setNama("");
      router.refresh();
    } catch (err: any) {
      toast.error("Gagal menambah", { description: err.message });
    } finally {
      setLoading(false);
    }
  }

  async function confirmRemove() {
    if (!confirmTarget) return;
    setDeletingId(confirmTarget.id);
    try {
      const res = await fetch(`/api/pelanggan/${confirmTarget.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error((await res.json()).error);
      toast.success("Nama dihapus.");
      setConfirmTarget(null);
      router.refresh();
    } catch (err: any) {
      toast.error("Gagal menghapus", { description: err.message });
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Users className="h-4 w-4" /> Pelanggan Tersimpan</CardTitle>
        <CardDescription>
          Daftar nama untuk autocomplete saat kasir input pesanan langsung. Nama baru otomatis tersimpan tiap kasir mengetik nama baru.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <form onSubmit={add} className="flex gap-2">
          <FormFieldset disabled={loading} className="flex flex-1 gap-2">
            <Input placeholder="Tambah nama baru..." value={nama} onChange={(e) => setNama(e.target.value)} className="h-8" />
            <Button type="submit" size="sm" disabled={loading || !nama.trim()}>
              {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
            </Button>
          </FormFieldset>
        </form>
        <div className="flex flex-wrap gap-2">
          {customers.length ? customers.map((c) => (
            <Badge key={c.id} variant="secondary" className="gap-1.5 py-1 pl-2.5 pr-1.5">
              {c.nama}
              <button onClick={() => setConfirmTarget(c)} disabled={deletingId === c.id} className="rounded-full p-0.5 hover:bg-background/60">
                {deletingId === c.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
              </button>
            </Badge>
          )) : <p className="text-sm text-muted-foreground">Belum ada nama tersimpan.</p>}
        </div>
      </CardContent>

      <ConfirmDialog
        open={!!confirmTarget}
        onOpenChange={(o) => !o && setConfirmTarget(null)}
        title={`Hapus "${confirmTarget?.nama}"?`}
        description="Nama ini tidak akan muncul lagi di saran autocomplete kasir."
        confirmLabel="Ya, Hapus"
        destructive
        loading={!!deletingId}
        onConfirm={confirmRemove}
      />
    </Card>
  );
}
