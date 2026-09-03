import type { createAdminClient } from "@/lib/supabase/server";
import { sendMail } from "@/lib/mail";
import { monthlyReportAdminEmail, type MonthlyReportRow } from "@/lib/mail-templates";

/**
 * Ambil ringkasan BULAN LALU (bulan penuh yang sudah selesai, bukan bulan
 * berjalan) lewat RPC get_monthly_summary yang sama dipakai grafik
 * dashboard admin, lalu kirim email ke semua admin aktif. Dipakai oleh
 * dua pemanggil — /api/cron/monthly-report (otomatis tiap awal bulan) dan
 * tombol "Kirim Laporan Bulanan Sekarang" di Admin > Pengaturan — supaya
 * perilaku & isi emailnya konsisten dari kedua jalur.
 *
 * p_months: 2 -> baris [bulan_lalu, bulan_berjalan] terurut menaik (lihat
 * definisi get_monthly_summary di schema.sql) — ambil index 0 (bulan lalu).
 */
export async function generateAndSendMonthlyReport(
  admin: ReturnType<typeof createAdminClient>
): Promise<{ sent: boolean; recipients: string[]; periodLabel: string; reason?: string }> {
  const { data: rows, error } = await admin.rpc("get_monthly_summary", { p_months: 2 });
  if (error || !rows || rows.length === 0) {
    return { sent: false, recipients: [], periodLabel: "", reason: error?.message ?? "Data laporan tidak tersedia." };
  }

  const lastMonthRow = rows[0] as MonthlyReportRow & { bulan: string };
  const periodLabel = new Intl.DateTimeFormat("id-ID", { month: "long", year: "numeric", timeZone: "UTC" }).format(
    new Date(lastMonthRow.bulan)
  );

  const { data: admins } = await admin
    .from("profiles")
    .select("email")
    .eq("role", "admin")
    .eq("status", "active")
    .not("email", "is", null);
  const recipients = (admins ?? []).map((a) => a.email).filter((e): e is string => !!e);

  if (recipients.length === 0) {
    return { sent: false, recipients: [], periodLabel, reason: "Tidak ada admin aktif dengan email terdaftar." };
  }

  const { subject, html } = monthlyReportAdminEmail({ periodLabel, row: lastMonthRow });
  const sent = await sendMail({ to: recipients, subject, html });

  return { sent, recipients, periodLabel };
}
