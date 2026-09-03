import { NextResponse } from "next/server";
import { requireRole } from "@/lib/supabase/require-role";
import { logActivity } from "@/lib/activity-log";
import { ACTIVITY_ACTIONS } from "@/lib/constants";

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  try {
    const { admin, profile } = await requireRole(["admin"]);
    const body = await request.json();
    const patch: Record<string, unknown> = {};
    if ("nama" in body) patch.nama = body.nama;
    if ("is_active" in body) patch.is_active = body.is_active;
    // Info pembayaran ke pelanggan (v9): switch utama + dua sub-switch
    // (teks & gambar), masing-masing dengan isinya sendiri.
    if ("tampilkan_info_pembayaran" in body) patch.tampilkan_info_pembayaran = !!body.tampilkan_info_pembayaran;
    if ("tampilkan_teks" in body) patch.tampilkan_teks = !!body.tampilkan_teks;
    if ("info_teks" in body) patch.info_teks = body.info_teks || null;
    if ("tampilkan_gambar" in body) patch.tampilkan_gambar = !!body.tampilkan_gambar;
    if ("info_gambar_url" in body) patch.info_gambar_url = body.info_gambar_url || null;

    const { error } = await admin.from("payment_methods").update(patch).eq("id", params.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    await logActivity({
      admin, userId: profile.id, namaUser: profile.nama, aksi: ACTIVITY_ACTIONS.METODE_PEMBAYARAN,
      deskripsi: `Mengubah metode pembayaran ${params.id}`, request,
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
    const { error } = await admin.from("payment_methods").delete().eq("id", params.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    await logActivity({
      admin, userId: profile.id, namaUser: profile.nama, aksi: ACTIVITY_ACTIONS.METODE_PEMBAYARAN,
      deskripsi: `Menghapus metode pembayaran ${params.id}`, request,
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof Response) return e;
    return NextResponse.json({ error: "Terjadi kesalahan." }, { status: 500 });
  }
}
