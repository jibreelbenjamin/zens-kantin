import { NextResponse } from "next/server";
import { requireRole } from "@/lib/supabase/require-role";
import { logActivity } from "@/lib/activity-log";
import { ACTIVITY_ACTIONS } from "@/lib/constants";
import { generateAndSendMonthlyReport } from "@/lib/monthly-report";

/** Tombol "Kirim Laporan Bulanan Sekarang" di Admin > Pengaturan — lihat catatan lengkap di /api/cron/monthly-report. */
export async function POST(request: Request) {
  try {
    const { admin, profile } = await requireRole(["admin"]);
    const result = await generateAndSendMonthlyReport(admin);

    if (!result.sent) {
      return NextResponse.json({ error: result.reason ?? "Gagal mengirim laporan." }, { status: 400 });
    }

    await logActivity({
      admin, userId: profile.id, namaUser: profile.nama,
      aksi: ACTIVITY_ACTIONS.LAPORAN_BULANAN_DIKIRIM,
      deskripsi: `Mengirim laporan bulanan ${result.periodLabel} ke ${result.recipients.length} admin (manual)`,
      request,
    });

    return NextResponse.json(result);
  } catch (e) {
    if (e instanceof Response) return e;
    return NextResponse.json({ error: "Terjadi kesalahan." }, { status: 500 });
  }
}
