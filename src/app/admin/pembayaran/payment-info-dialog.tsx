"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, Settings2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger, DialogDescription, DialogClose,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ImageUpload } from "@/components/shared/image-upload";
import { FormFieldset } from "@/components/shared/form-fieldset";
import { APP_NAME } from "@/lib/constants";
import type { PaymentMethod } from "@/types/database";

/**
 * Pengaturan info pembayaran per metode — ditampilkan ke pelanggan setelah
 * checkout, SEBELUM pesanan dianggap selesai, lengkap dengan tombol
 * "Saya Sudah Membayar". Dua sub-opsi (teks & gambar) independen, boleh
 * diaktifkan salah satu atau keduanya.
 */
export function PaymentInfoDialog({ item }: { item: PaymentMethod }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [tampilkanInfo, setTampilkanInfo] = React.useState(item.tampilkan_info_pembayaran);
  const [tampilkanTeks, setTampilkanTeks] = React.useState(item.tampilkan_teks);
  const [infoTeks, setInfoTeks] = React.useState(item.info_teks ?? "");
  const [tampilkanGambar, setTampilkanGambar] = React.useState(item.tampilkan_gambar);
  const [infoGambar, setInfoGambar] = React.useState<string | null>(item.info_gambar_url);

  React.useEffect(() => {
    if (open) {
      setTampilkanInfo(item.tampilkan_info_pembayaran);
      setTampilkanTeks(item.tampilkan_teks);
      setInfoTeks(item.info_teks ?? "");
      setTampilkanGambar(item.tampilkan_gambar);
      setInfoGambar(item.info_gambar_url);
    }
  }, [open, item]);

  async function submit() {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/pembayaran/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tampilkan_info_pembayaran: tampilkanInfo,
          tampilkan_teks: tampilkanTeks,
          info_teks: infoTeks || null,
          tampilkan_gambar: tampilkanGambar,
          info_gambar_url: infoGambar,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      toast.success("Info pembayaran diperbarui.");
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
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8" title="Info pembayaran untuk pelanggan">
          <Settings2 className="h-3.5 w-3.5" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Info Pembayaran — {item.nama}</DialogTitle>
          <DialogDescription>
            Ditampilkan ke pelanggan setelah checkout, sebelum pesanan selesai, lengkap dengan tombol
            &quot;Saya Sudah Membayar&quot;.
          </DialogDescription>
        </DialogHeader>
        <FormFieldset disabled={loading} className="space-y-4">
          <div className="flex items-start justify-between gap-3 rounded-lg border p-3">
            <div>
              <Label htmlFor="switch-info" className="cursor-pointer font-medium">
                Tampilkan informasi pembayaran ke pelanggan
              </Label>
              <p className="text-xs text-muted-foreground">
                Tampilkan layar info (teks/gambar) + tombol konfirmasi setelah pelanggan checkout dengan metode ini.
              </p>
            </div>
            <Switch id="switch-info" checked={tampilkanInfo} onCheckedChange={setTampilkanInfo} />
          </div>

          <div className={tampilkanInfo ? "space-y-4" : "pointer-events-none space-y-4 opacity-50"}>
            <div className="flex items-center justify-between gap-3 rounded-lg border p-3">
              <Label htmlFor="switch-teks" className="cursor-pointer font-medium">Tampilkan teks</Label>
              <Switch id="switch-teks" checked={tampilkanTeks} onCheckedChange={setTampilkanTeks} disabled={!tampilkanInfo} />
            </div>
            {tampilkanTeks && (
              <Textarea
                placeholder={`cth. Transfer ke BCA 1234567890 a.n. ${APP_NAME}`}
                value={infoTeks}
                onChange={(e) => setInfoTeks(e.target.value)}
                rows={3}
                disabled={!tampilkanInfo}
              />
            )}

            <div className="flex items-center justify-between gap-3 rounded-lg border p-3">
              <Label htmlFor="switch-gambar" className="cursor-pointer font-medium">Tampilkan gambar</Label>
              <Switch id="switch-gambar" checked={tampilkanGambar} onCheckedChange={setTampilkanGambar} disabled={!tampilkanInfo} />
            </div>
            {tampilkanGambar && (
              <ImageUpload value={infoGambar} onChange={setInfoGambar} folder="payment" label="Gambar (mis. kode QRIS)" optional />
            )}
          </div>
        </FormFieldset>
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline" disabled={loading}>Batal</Button>
          </DialogClose>
          <Button type="button" onClick={submit} disabled={loading}>
            {loading && <Loader2 className="h-4 w-4 animate-spin" />} Simpan
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
