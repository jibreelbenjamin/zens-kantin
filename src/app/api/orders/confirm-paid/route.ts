import { NextResponse } from "next/server";
import { requireRole } from "@/lib/supabase/require-role";
import { logActivity } from "@/lib/activity-log";
import { ACTIVITY_ACTIONS } from "@/lib/constants";

/**
 * Pelanggan menandai "saya sudah membayar" untuk satu kelompok pesanan
 * miliknya. Ini HANYA klaim/penanda buat kasir — status pesanan tetap
 * "pending" sampai kasir benar-benar mengonfirmasi lewat confirm_payment.
 */
export async function POST(request: Request) {
  try {
    const { supabase, admin, profile } = await requireRole(["pelanggan"]);
    const { group_id } = await request.json();
    if (!group_id) return NextResponse.json({ error: "Data tidak valid." }, { status: 400 });

    // Dipanggil lewat sesi user sendiri karena function memverifikasi
    // kepemilikan pesanan dari auth.uid().
    const { data, error } = await supabase.rpc("confirm_customer_paid", { p_group_id: group_id });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    const rows = (data ?? []) as { nama_produk: string; qty: number }[];
    if (rows.length > 0) {
      await logActivity({
        admin, userId: profile.id, namaUser: profile.nama, aksi: ACTIVITY_ACTIONS.KLAIM_BAYAR,
        deskripsi: `${profile.nama} mengklaim sudah membayar (${rows.length} item)`, request,
      });
    }

    return NextResponse.json({ orders: data });
  } catch (e) {
    if (e instanceof Response) return e;
    return NextResponse.json({ error: "Terjadi kesalahan." }, { status: 500 });
  }
}
