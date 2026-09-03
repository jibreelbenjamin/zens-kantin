import { NextResponse } from "next/server";
import { requireRole } from "@/lib/supabase/require-role";
import { logActivity } from "@/lib/activity-log";
import { ACTIVITY_ACTIONS } from "@/lib/constants";

/** Konfirmasi sekelompok pesanan (satu group_id) sebagai lunas sekaligus. */
export async function POST(request: Request) {
  try {
    const { supabase, admin, profile } = await requireRole(["admin", "kasir"]);
    const { order_ids, bukti_bayar_url } = await request.json();

    if (!Array.isArray(order_ids) || order_ids.length === 0) {
      return NextResponse.json({ error: "Data tidak valid." }, { status: 400 });
    }

    // Dipanggil lewat sesi user sendiri karena confirm_payment_batch mengambil
    // identitas kasir dari auth.uid().
    const { data, error } = await supabase.rpc("confirm_payment_batch", {
      p_order_ids: order_ids,
      p_bukti_bayar_url: bukti_bayar_url || null,
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    const rows = (data ?? []) as { nama_pemesan: string }[];
    if (rows.length > 0) {
      await logActivity({
        admin, userId: profile.id, namaUser: profile.nama, aksi: ACTIVITY_ACTIONS.PEMBAYARAN,
        deskripsi: `Konfirmasi lunas: ${rows[0].nama_pemesan} (${rows.length} item)`, request,
      });
    }

    return NextResponse.json({ orders: data });
  } catch (e) {
    if (e instanceof Response) return e;
    return NextResponse.json({ error: "Terjadi kesalahan." }, { status: 500 });
  }
}
