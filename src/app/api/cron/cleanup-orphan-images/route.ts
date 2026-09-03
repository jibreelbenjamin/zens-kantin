import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { verifyCronSecret } from "@/lib/cron-auth";
import { logActivity } from "@/lib/activity-log";
import { ACTIVITY_ACTIONS } from "@/lib/constants";
import { scanOrphanFiles, deleteStorageFiles } from "@/lib/file-manager";

/**
 * Pembersihan OTOMATIS file storage yang sudah tidak dirujuk data apa pun
 * (lihat scanOrphanFiles di lib/file-manager.ts untuk penjelasan lengkap
 * & jeda keamanan ORPHAN_MIN_AGE_HOURS-nya). Dipanggil dari CRONTAB DI
 * SERVER (bukan pg_cron — pg_cron cuma bisa jalankan SQL polos, sedangkan
 * menghapus file storage dengan benar butuh Storage API asli lewat
 * .remove(), bukan DELETE langsung ke tabel storage.objects), mirip pola
 * "Reset Log" manual yang sudah ada tapi untuk kasus yang benar-benar bisa
 * otomatis penuh tanpa risiko (grace period 24 jam sudah menyaring file
 * yang mungkin masih dipakai form yang belum disubmit).
 *
 * Contoh crontab (jalan tiap hari jam 3 pagi) — lihat juga .env.example:
 *   0 3 * * * curl -fsS -X POST https://domain-kamu/api/cron/cleanup-orphan-images \
 *     -H "Authorization: Bearer $CRON_SECRET"
 *
 * Tombol "Cari File Tidak Terpakai" di Admin > File Manager memakai
 * scanOrphanFiles + deleteStorageFiles yang SAMA, bedanya lewat konfirmasi
 * admin dulu — dua jalur, satu fungsi inti, supaya perilakunya konsisten.
 */
export async function POST(request: Request) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: "Tidak diizinkan." }, { status: 401 });
  }

  try {
    const scan = await scanOrphanFiles();
    if ("error" in scan) {
      return NextResponse.json({ error: scan.error }, { status: scan.status });
    }

    if (scan.orphans.length === 0) {
      return NextResponse.json({ deleted: 0, scanned: scan.totalScanned });
    }

    const result = await deleteStorageFiles(scan.orphans.map((o) => o.path));
    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    const admin = createAdminClient();
    await logActivity({
      admin,
      userId: null,
      namaUser: "Sistem (cron)",
      aksi: ACTIVITY_ACTIONS.FILE_BERSIH_OTOMATIS,
      deskripsi: `Membersihkan otomatis ${result.deleted.length} file tidak terpakai (dari ${scan.totalScanned} file dipindai)`,
      request,
    });

    return NextResponse.json({ deleted: result.deleted.length, scanned: scan.totalScanned });
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? "Terjadi kesalahan." }, { status: 500 });
  }
}
