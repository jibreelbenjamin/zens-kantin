import { NextResponse } from "next/server";
import { requireRole } from "@/lib/supabase/require-role";
import { logActivity } from "@/lib/activity-log";
import { ACTIVITY_ACTIONS } from "@/lib/constants";

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  try {
    const { admin, profile } = await requireRole(["admin"]);
    const body = await request.json();
    // `stok` & `modal` sengaja TIDAK ada di daftar ini — keduanya hanya boleh
    // berubah lewat trigger DB dari Input Stok / Tarik Kembali, supaya
    // riwayatnya konsisten & bisa diaudit.
    const allowed = ["nama", "gambar_url", "harga_jual", "is_active", "kategori_id"];
    const patch: Record<string, unknown> = {};
    for (const k of allowed) if (k in body) patch[k] = body[k];
    patch.updated_at = new Date().toISOString();

    const { error } = await admin.from("products").update(patch).eq("id", params.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    await logActivity({
      admin, userId: profile.id, namaUser: profile.nama, aksi: ACTIVITY_ACTIONS.PRODUK_UBAH,
      deskripsi: `Mengubah produk ${params.id}`, request,
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
    const { error } = await admin.from("products").delete().eq("id", params.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    await logActivity({
      admin, userId: profile.id, namaUser: profile.nama, aksi: ACTIVITY_ACTIONS.PRODUK_HAPUS,
      deskripsi: `Menghapus produk ${params.id}`, request,
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof Response) return e;
    return NextResponse.json({ error: "Terjadi kesalahan." }, { status: 500 });
  }
}
