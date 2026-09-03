import { NextResponse } from "next/server";
import { requireRole } from "@/lib/supabase/require-role";
import { logActivity } from "@/lib/activity-log";
import { ACTIVITY_ACTIONS } from "@/lib/constants";
import { listStorage, deleteStorageFiles } from "@/lib/file-manager";

// Batasi daftar nama file yang ditulis ke deskripsi log — bisa ratusan
// kalau admin pilih-semua di folder besar, deskripsi log tidak perlu
// memuat semuanya (jumlah totalnya sudah tercatat di angka depan).
function summarizeNames(names: string[], max = 10): string {
  if (names.length <= max) return names.join(", ");
  return `${names.slice(0, max).join(", ")}, dan ${names.length - max} lainnya`;
}

export async function GET(request: Request) {
  try {
    await requireRole(["admin"]);

    const { searchParams } = new URL(request.url);
    const path = searchParams.get("path") ?? "";

    const result = await listStorage(path);
    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }
    return NextResponse.json(result);
  } catch (e) {
    if (e instanceof Response) return e;
    return NextResponse.json({ error: "Terjadi kesalahan." }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { admin, profile } = await requireRole(["admin"]);

    const body = await request.json().catch(() => null);
    const paths = Array.isArray(body?.paths) ? body.paths : [];
    // "orphan_cleanup" dikirim file-manager-client.tsx saat penghapusan ini
    // berasal dari hasil pindaian "Cari File Tidak Terpakai" — dicatat
    // dengan aksi log yang berbeda supaya riwayatnya kelihatan jelas beda
    // dari admin menghapus file pilihannya sendiri secara manual.
    const source = body?.source === "orphan_cleanup" ? "orphan_cleanup" : "manual";

    const result = await deleteStorageFiles(paths);
    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    await logActivity({
      admin, userId: profile.id, namaUser: profile.nama,
      aksi: source === "orphan_cleanup" ? ACTIVITY_ACTIONS.FILE_BERSIH_OTOMATIS : ACTIVITY_ACTIONS.FILE_HAPUS,
      deskripsi: source === "orphan_cleanup"
        ? `Membersihkan ${result.deleted.length} file tidak terpakai: ${summarizeNames(result.deleted)}`
        : `Menghapus ${result.deleted.length} file: ${summarizeNames(result.deleted)}`,
      request,
    });

    return NextResponse.json(result);
  } catch (e) {
    if (e instanceof Response) return e;
    return NextResponse.json({ error: "Terjadi kesalahan." }, { status: 500 });
  }
}
