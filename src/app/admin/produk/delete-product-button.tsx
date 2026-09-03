"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";

export function DeleteProductButton({ id, nama }: { id: string; nama: string }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(false);

  async function handleDelete() {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/produk/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error((await res.json()).error);
      toast.success("Produk dihapus.");
      setOpen(false);
      router.refresh();
    } catch (err: any) {
      toast.error("Gagal menghapus", { description: err.message });
    } finally {
      setLoading(false);
    }
  }

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={setOpen}
      trigger={
        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive">
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      }
      title={`Hapus "${nama}"?`}
      description="Tindakan ini tidak bisa dibatalkan. Riwayat pesanan lama tidak akan terhapus."
      confirmLabel="Ya, Hapus"
      destructive
      loading={loading}
      onConfirm={handleDelete}
    />
  );
}
