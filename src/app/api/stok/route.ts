import { NextResponse } from "next/server";
import { requireRole } from "@/lib/supabase/require-role";
import { logActivity } from "@/lib/activity-log";
import { ACTIVITY_ACTIONS } from "@/lib/constants";

/** Input stok barang masuk — otomatis menambah stok produk (lewat trigger DB). */
export async function POST(request: Request) {
  try {
    const { admin, profile } = await requireRole(["admin", "kasir"]);
    const { produk_id, total_beli, qty, gambar_url } = await request.json();

    if (!produk_id || Number(qty) <= 0 || Number(total_beli) < 0) {
      return NextResponse.json({ error: "Data stok tidak valid." }, { status: 400 });
    }

    const { data: product } = await admin.from("products").select("nama").eq("id", produk_id).single();
    if (!product) return NextResponse.json({ error: "Produk tidak ditemukan." }, { status: 400 });

    const { data, error } = await admin
      .from("stock_entries")
      .insert({
        user_id: profile.id,
        produk_id,
        nama_produk: product.nama,
        total_beli: Number(total_beli),
        qty: Number(qty),
        gambar_url: gambar_url ?? null,
      })
      .select()
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    await logActivity({
      admin, userId: profile.id, namaUser: profile.nama, aksi: ACTIVITY_ACTIONS.STOK_MASUK,
      deskripsi: `Menambah stok ${product.nama} sebanyak ${qty}`, request,
    });

    return NextResponse.json({ data });
  } catch (e) {
    if (e instanceof Response) return e;
    return NextResponse.json({ error: "Terjadi kesalahan." }, { status: 500 });
  }
}
