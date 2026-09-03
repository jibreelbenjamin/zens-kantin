import { NextResponse } from "next/server";
import { requireRole } from "@/lib/supabase/require-role";
import { logActivity } from "@/lib/activity-log";
import { ACTIVITY_ACTIONS } from "@/lib/constants";

/** Batalkan (hapus) data penghapusan stok — stok produk dikembalikan otomatis. */
export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  try {
    const { supabase, admin, profile } = await requireRole(["admin", "kasir"]);
    // Ambil detailnya dulu untuk keperluan log — setelah RPC di bawah,
    // barisnya sudah terhapus.
    const { data: writeoff } = await supabase.from("stock_writeoffs").select("nama_produk,qty").eq("id", params.id).maybeSingle();

    // Dipanggil lewat sesi user sendiri karena function mengambil identitas
    // dari auth.uid().
    const { error } = await supabase.rpc("delete_stock_writeoff", { p_id: params.id });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    await logActivity({
      admin, userId: profile.id, namaUser: profile.nama, aksi: ACTIVITY_ACTIONS.STOK_HAPUS_DIBATALKAN,
      deskripsi: `Membatalkan penghapusan stok ${writeoff?.nama_produk ?? params.id}` +
        (writeoff?.qty ? ` (${writeoff.qty} dikembalikan)` : ""),
      request,
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof Response) return e;
    return NextResponse.json({ error: "Terjadi kesalahan." }, { status: 500 });
  }
}
