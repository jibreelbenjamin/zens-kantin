import { NextResponse } from "next/server";
import { requireRole } from "@/lib/supabase/require-role";
import { logActivity } from "@/lib/activity-log";
import { ACTIVITY_ACTIONS } from "@/lib/constants";

/** Penghapusan stok (rusak/hilang/kadaluarsa) — murni mengurangi stok, tidak menghitung/mengembalikan kerugian (sudah terhitung penuh saat input). */
export async function POST(request: Request) {
  try {
    const { supabase, admin, profile } = await requireRole(["admin", "kasir"]);
    const { produk_id, qty, keterangan } = await request.json();

    if (!produk_id || Number(qty) <= 0) {
      return NextResponse.json({ error: "Data tidak valid." }, { status: 400 });
    }

    // Dipanggil lewat sesi user sendiri (bukan service-role) karena function
    // create_stock_writeoff mengambil identitas dari auth.uid().
    const { data, error } = await supabase.rpc("create_stock_writeoff", {
      p_produk_id: produk_id,
      p_qty: Number(qty),
      p_keterangan: keterangan || null,
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    await logActivity({
      admin, userId: profile.id, namaUser: profile.nama, aksi: ACTIVITY_ACTIONS.STOK_DIHAPUS,
      deskripsi: `Menghapus stok ${data?.nama_produk ?? produk_id} sebanyak ${qty}`,
      request,
    });

    return NextResponse.json({ data });
  } catch (e) {
    if (e instanceof Response) return e;
    return NextResponse.json({ error: "Terjadi kesalahan." }, { status: 500 });
  }
}
