"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";

export function ProductActiveSwitch({ id, isActive }: { id: string; isActive: boolean }) {
  const router = useRouter();
  const [checked, setChecked] = React.useState(isActive);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => setChecked(isActive), [isActive]);

  async function toggle(next: boolean) {
    setChecked(next);
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/produk/${id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ is_active: next }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      toast.success(next ? "Produk ditampilkan ke pelanggan." : "Produk disembunyikan dari pelanggan.");
      router.refresh();
    } catch (err: any) {
      setChecked(!next);
      toast.error("Gagal mengubah status", { description: err.message });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <Switch checked={checked} onCheckedChange={toggle} disabled={loading} />
      <span className="text-xs text-muted-foreground">{checked ? "Tampil" : "Sembunyi"}</span>
    </div>
  );
}
