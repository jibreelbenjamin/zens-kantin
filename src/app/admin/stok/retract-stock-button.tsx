"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { Undo2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import type { StockEntry } from "@/types/database";

export function RetractStockButton({ entry }: { entry: StockEntry }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(false);

  async function retract() {
    setLoading(true);
    try {
      const res = await fetch(`/api/stok/${entry.id}/retract`, { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      toast.success(`Stok ${entry.nama_produk} ditarik kembali.`);
      setOpen(false);
      router.refresh();
    } catch (err: any) {
      toast.error("Gagal menarik stok", { description: err.message });
    } finally {
      setLoading(false);
    }
  }

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={setOpen}
      trigger={
        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" title="Tarik kembali stok ini">
          <Undo2 className="h-3.5 w-3.5" />
        </Button>
      }
      title={`Tarik kembali stok "${entry.nama_produk}"?`}
      description={`Stok produk akan dikurangi ${entry.qty} dan entri ini dihapus dari riwayat. Hanya bisa dilakukan jika stok saat ini masih cukup (belum banyak terjual).`}
      confirmLabel="Ya, Tarik Kembali"
      destructive
      loading={loading}
      onConfirm={retract}
    />
  );
}
