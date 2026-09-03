"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";

export function DeleteExpenseButton({ id, nama }: { id: string; nama: string }) {
  const router = useRouter();
  const [loading, setLoading] = React.useState(false);
  const [open, setOpen] = React.useState(false);

  async function handleDelete() {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/pengeluaran/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error((await res.json()).error);
      toast.success("Pengeluaran dihapus.");
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
      trigger={<Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></Button>}
      title={`Hapus "${nama}"?`}
      description="Nominal ini tidak akan lagi mengurangi keuntungan di laporan."
      confirmLabel="Ya, Hapus"
      destructive
      loading={loading}
      onConfirm={handleDelete}
    />
  );
}
