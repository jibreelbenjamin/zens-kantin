import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { verifyCronSecret } from "@/lib/cron-auth";
import { logActivity } from "@/lib/activity-log";
import { ACTIVITY_ACTIONS } from "@/lib/constants";
import { generateAndSendMonthlyReport } from "@/lib/monthly-report";

/**
 * Kirim laporan bulanan kantin ke semua admin aktif — otomatis lewat
 * CRONTAB DI SERVER (bukan pg_cron, karena mengirim email butuh Node/
 * Nodemailer, bukan sesuatu yang bisa dilakukan pg_cron yang cuma
 * menjalankan SQL). Dijadwalkan berjalan awal bulan supaya melaporkan
 * bulan yang baru saja selesai (lihat generateAndSendMonthlyReport).
 *
 * Contoh crontab (jalan tanggal 1 tiap bulan jam 7 pagi) — lihat juga .env.example:
 *   0 7 1 * * curl -fsS -X POST https://domain-kamu/api/cron/monthly-report \
 *     -H "Authorization: Bearer $CRON_SECRET"
 *
 * Tombol "Kirim Laporan Bulanan Sekarang" di Admin > Pengaturan memakai
 * fungsi generateAndSendMonthlyReport yang SAMA (beda jalur pemicu &
 * autentikasi saja), supaya isi & perilaku emailnya konsisten.
 */
export async function POST(request: Request) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: "Tidak diizinkan." }, { status: 401 });
  }

  try {
    const admin = createAdminClient();
    const result = await generateAndSendMonthlyReport(admin);

    if (result.sent) {
      await logActivity({
        admin, userId: null, namaUser: "Sistem (cron)",
        aksi: ACTIVITY_ACTIONS.LAPORAN_BULANAN_DIKIRIM,
        deskripsi: `Mengirim laporan bulanan ${result.periodLabel} ke ${result.recipients.length} admin`,
        request,
      });
    }

    return NextResponse.json(result);
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? "Terjadi kesalahan." }, { status: 500 });
  }
}
