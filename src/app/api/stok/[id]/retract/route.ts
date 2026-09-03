import { NextResponse } from "next/server";
import { requireRole } from "@/lib/supabase/require-role";
import { logActivity } from "@/lib/activity-log";
import { ACTIVITY_ACTIONS } from "@/lib/constants";

/** Tarik kembali (batalkan) satu entri stok masuk — hanya jika stok produk saat ini masih cukup. */
export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    const { supabase, admin, profile } = await requireRole(["admin", "kasir"]);
    // Dipanggil lewat sesi user sendiri (bukan service-role) karena function
    // retract_stock_entry memverifikasi role dari auth.uid() secara internal.
    const { data, error } = await supabase.rpc("retract_stock_entry", { p_entry_id: params.id });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    await logActivity({
      admin, userId: profile.id, namaUser: profile.nama, aksi: ACTIVITY_ACTIONS.STOK_DITARIK,
      deskripsi: `Menarik kembali stok ${data?.nama_produk ?? params.id} sebanyak ${data?.qty ?? ""}`,
      request,
    });

    return NextResponse.json({ ok: true, data });
  } catch (e) {
    if (e instanceof Response) return e;
    return NextResponse.json({ error: "Terjadi kesalahan." }, { status: 500 });
  }
}
