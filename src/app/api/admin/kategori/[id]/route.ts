import { NextResponse } from "next/server";
import { requireRole } from "@/lib/supabase/require-role";
import { logActivity } from "@/lib/activity-log";
import { ACTIVITY_ACTIONS } from "@/lib/constants";

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  try {
    const { admin, profile } = await requireRole(["admin"]);
    const { nama } = await request.json();
    if (!nama || !nama.trim()) {
      return NextResponse.json({ error: "Nama kategori tidak boleh kosong." }, { status: 400 });
    }
    const { error } = await admin.from("categories").update({ nama: nama.trim() }).eq("id", params.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    await logActivity({
      admin, userId: profile.id, namaUser: profile.nama, aksi: ACTIVITY_ACTIONS.KATEGORI_UBAH,
      deskripsi: `Mengubah kategori ${params.id} menjadi ${nama}`, request,
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof Response) return e;
    return NextResponse.json({ error: "Terjadi kesalahan." }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  try {
    const { admin, profile } = await requireRole(["admin"]);
    // Produk dengan kategori ini otomatis jadi "tanpa kategori" (ON DELETE
    // SET NULL di skema), tidak ikut terhapus.
    const { error } = await admin.from("categories").delete().eq("id", params.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    await logActivity({
      admin, userId: profile.id, namaUser: profile.nama, aksi: ACTIVITY_ACTIONS.KATEGORI_UBAH,
      deskripsi: `Menghapus kategori ${params.id}`, request,
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof Response) return e;
    return NextResponse.json({ error: "Terjadi kesalahan." }, { status: 500 });
  }
}
