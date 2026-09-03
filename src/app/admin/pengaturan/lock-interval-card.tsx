"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, TimerReset } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { NumberInput } from "@/components/shared/number-input";
import { FormFieldset } from "@/components/shared/form-fieldset";

export function LockIntervalCard({ currentMinutes }: { currentMinutes: number }) {
  const router = useRouter();
  const [minutes, setMinutes] = React.useState(currentMinutes);
  const [loading, setLoading] = React.useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (minutes < 1 || minutes > 60) {
      toast.error("Interval harus antara 1-60 menit.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/admin/pengaturan", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: "kasir_lock_interval_minutes", value: String(minutes) }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      toast.success("Interval kunci layar diperbarui.");
      router.refresh();
    } catch (err: any) {
      toast.error("Gagal menyimpan", { description: err.message });
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><TimerReset className="h-4 w-4" /> Interval Kunci Layar Kasir</CardTitle>
        <CardDescription>
          Layar kasir otomatis terkunci (butuh PIN) setelah tidak ada aktivitas selama durasi ini. Default 3 menit.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={save} className="flex flex-wrap items-end gap-3">
          <FormFieldset disabled={loading} className="flex flex-wrap items-end gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="interval">Menit</Label>
              <NumberInput id="interval" min={1} value={minutes} onChange={setMinutes} className="w-28" />
            </div>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 animate-spin" />} Simpan
            </Button>
          </FormFieldset>
        </form>
      </CardContent>
    </Card>
  );
}
