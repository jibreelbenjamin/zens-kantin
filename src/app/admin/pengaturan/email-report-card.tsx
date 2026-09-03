"use client";
import * as React from "react";
import { Loader2, Mail, Send } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function EmailReportCard() {
  const [sending, setSending] = React.useState(false);

  async function sendNow() {
    setSending(true);
    try {
      const res = await fetch("/api/admin/pengaturan/kirim-laporan", { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Gagal mengirim laporan.");
      toast.success(`Laporan ${json.periodLabel} terkirim ke ${json.recipients.length} admin.`);
    } catch (err: any) {
      toast.error("Gagal mengirim laporan", { description: err.message });
    } finally {
      setSending(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Mail className="h-4 w-4" /> Email Notifikasi</CardTitle>
        <CardDescription>
          Dikirim lewat Gmail (butuh GMAIL_USER & GMAIL_APP_PASSWORD di env server — lihat .env.example). Otomatis
          terkirim saat: status akun klien disetujui/diblokir, ada pendaftaran akun baru (ke semua admin aktif), dan
          laporan bulanan (ke semua admin aktif, otomatis awal bulan lewat cron — lihat .env.example untuk contoh
          crontab-nya). Tombol di bawah untuk mengirim laporan bulan lalu secara manual, mis. untuk mencoba
          konfigurasi email atau kalau cron belum terpasang.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button onClick={sendNow} disabled={sending} variant="outline">
          {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          Kirim Laporan Bulanan Sekarang
        </Button>
      </CardContent>
    </Card>
  );
}
