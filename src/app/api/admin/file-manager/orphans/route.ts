import { NextResponse } from "next/server";
import { requireRole } from "@/lib/supabase/require-role";
import { scanOrphanFiles } from "@/lib/file-manager";

/**
 * Pindai file di storage yang sudah tidak dirujuk data apa pun (lihat
 * scanOrphanFiles di lib/file-manager.ts) — dipakai tombol "Cari File
 * Tidak Terpakai" di halaman File Manager. HANYA memindai & mengembalikan
 * daftar, TIDAK menghapus apa pun — penghapusan tetap lewat
 * DELETE /api/admin/file-manager setelah admin meninjau & konfirmasi,
 * sama seperti alur hapus manual.
 */
export async function GET() {
  try {
    await requireRole(["admin"]);
    const result = await scanOrphanFiles();
    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }
    return NextResponse.json(result);
  } catch (e) {
    if (e instanceof Response) return e;
    return NextResponse.json({ error: "Terjadi kesalahan." }, { status: 500 });
  }
}
