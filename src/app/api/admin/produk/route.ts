import { NextResponse } from "next/server";
import { requireRole } from "@/lib/supabase/require-role";
import { logActivity } from "@/lib/activity-log";
import { ACTIVITY_ACTIONS } from "@/lib/constants";

export async function POST(request: Request) {
  try {
    const { admin, profile } = await requireRole(["admin"]);
    const body = await request.json();
    const { nama, gambar_url, harga_jual, is_active, kategori_id } = body;
    if (!nama || Number(harga_jual) < 0) {
      return NextResponse.json({ error: "Data produk tidak valid." }, { status: 400 });
    }
    // stok & modal produk baru selalu mulai dari 0 — diisi lewat menu Input Stok.
    const { data, error } = await admin
      .from("products")
      .insert({
        nama, gambar_url: gambar_url ?? null,
        stok: 0, modal: 0, harga_jual: Number(harga_jual) || 0,
        is_active: is_active ?? true, kategori_id: kategori_id ?? null,
      })
      .select()
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    await logActivity({
      admin, userId: profile.id, namaUser: profile.nama, aksi: ACTIVITY_ACTIONS.PRODUK_TAMBAH,
      deskripsi: `Menambah produk ${nama}`, request,
    });

    return NextResponse.json({ data });
  } catch (e) {
    if (e instanceof Response) return e;
    return NextResponse.json({ error: "Terjadi kesalahan." }, { status: 500 });
  }
}
