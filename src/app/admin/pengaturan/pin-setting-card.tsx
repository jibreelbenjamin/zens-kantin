"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Loader2, KeyRound } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FormFieldset } from "@/components/shared/form-fieldset";

export function PinSettingCard({ currentPin }: { currentPin: string }) {
  const router = useRouter();
  const [pin, setPin] = React.useState(currentPin);
  const [show, setShow] = React.useState(false);
  const [loading, setLoading] = React.useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!/^\d{4}$/.test(pin)) {
      toast.error("PIN harus tepat 4 digit angka.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/admin/pengaturan", {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key: "kasir_pin", value: pin }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      toast.success("PIN kasir diperbarui.");
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
        <CardTitle className="flex items-center gap-2"><KeyRound className="h-4 w-4" /> PIN Kunci Kasir</CardTitle>
        <CardDescription>
          PIN 4 digit ini dipakai kasir untuk membuka kembali layar yang terkunci otomatis. Tersimpan
          terenkripsi di database, tapi tetap bisa dilihat & diubah admin kapan pun di sini, jadi tidak
          ada risiko lupa. Mengganti PIN langsung mengunci ulang semua layar kasir yang sedang terbuka.
          Layar kasir juga terkunci sementara (jeda) setelah 5 kali PIN salah dalam 5 menit.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={save} className="flex flex-wrap items-end gap-3">
          <FormFieldset disabled={loading} className="flex flex-wrap items-end gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="pin">PIN saat ini</Label>
              <div className="relative w-40">
                <Input
                  id="pin"
                  type={show ? "text" : "password"}
                  inputMode="numeric"
                  value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
                  className="pr-9 tabular-figures tracking-widest"
                />
                <button type="button" onClick={() => setShow((s) => !s)} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground">
                  {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 animate-spin" />} Simpan PIN
            </Button>
          </FormFieldset>
        </form>
      </CardContent>
    </Card>
  );
}
