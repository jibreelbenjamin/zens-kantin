"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { Undo2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import type { StockWriteoff } from "@/types/database";

export function UndoWriteoffButton({ writeoff }: { writeoff: StockWriteoff }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(false);

  async function undo() {
    setLoading(true);
    try {
      const res = await fetch(`/api/stok/writeoff/${writeoff.id}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      toast.success(`Stok ${writeoff.nama_produk} dikembalikan.`);
      setOpen(false);
      router.refresh();
    } catch (err: any) {
      toast.error("Gagal membatalkan", { description: err.message });
    } finally {
      setLoading(false);
    }
  }

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={setOpen}
      trigger={
        <Button variant="ghost" size="icon" className="h-8 w-8" title="Batalkan penghapusan ini">
          <Undo2 className="h-3.5 w-3.5" />
        </Button>
      }
      title={`Batalkan penghapusan "${writeoff.nama_produk}"?`}
      description={`Stok akan dikembalikan +${writeoff.qty}` + (writeoff.kembalikan_kerugian ? `, dan pengembalian kerugian ${writeoff.kerugian.toLocaleString("id-ID")} akan dibatalkan (kerugian tercatat penuh lagi).` : ".")}
      confirmLabel="Ya, Batalkan"
      loading={loading}
      onConfirm={undo}
    />
  );
}
