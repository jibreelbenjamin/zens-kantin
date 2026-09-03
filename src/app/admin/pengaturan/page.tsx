import { createAdminClient } from "@/lib/supabase/server";
import { decryptPin } from "@/lib/pin-crypto";
import { PinSettingCard } from "./pin-setting-card";
import { LockIntervalCard } from "./lock-interval-card";
import { EmailReportCard } from "./email-report-card";

export default async function PengaturanPage() {
  // app_settings sengaja tidak punya RLS select policy (lihat migrasi SQL) —
  // halaman ini hanya dirender di dalam AdminLayout yang sudah memverifikasi
  // role admin, jadi aman memakai service-role client langsung di sini.
  const admin = createAdminClient();
  const { data } = await admin.from("app_settings").select("*").in("key", ["kasir_pin", "kasir_lock_interval_minutes"]);
  const settings = Object.fromEntries((data ?? []).map((s) => [s.key, s.value]));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold">Pengaturan</h1>
        <p className="text-sm text-muted-foreground">Kelola PIN & interval kunci layar kasir, dan pengaturan aplikasi lainnya.</p>
      </div>

      {/* PIN tersimpan terenkripsi di database (lihat lib/pin-crypto.ts) —
          didekripsi di sini, di server, dan hanya dikirim ke halaman admin
          yang sudah diverifikasi role-nya oleh AdminLayout. */}
      <PinSettingCard currentPin={decryptPin(settings.kasir_pin) ?? "8888"} />
      <LockIntervalCard currentMinutes={Number(settings.kasir_lock_interval_minutes) || 3} />
      <EmailReportCard />
    </div>
  );
}
