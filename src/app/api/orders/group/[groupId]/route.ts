import { NextResponse } from "next/server";
import { requireRole } from "@/lib/supabase/require-role";

/**
 * Status ringkas satu kelompok pesanan (satu checkout) — dipakai layar
 * tunggu pelanggan setelah checkout untuk polling apakah kasir sudah
 * mengonfirmasi pembayaran, tanpa perlu buka riwayat pesanan penuh.
 */
export async function GET(_request: Request, { params }: { params: { groupId: string } }) {
  try {
    const { supabase, profile } = await requireRole(["admin", "kasir", "pelanggan"]);
    let query = supabase
      .from("orders")
      .select("id,status_pembayaran,dikonfirmasi_pelanggan")
      .eq("group_id", params.groupId);
    if (profile.role === "pelanggan") query = query.eq("user_id", profile.id);

    const { data, error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    return NextResponse.json({ orders: data ?? [] });
  } catch (e) {
    if (e instanceof Response) return e;
    return NextResponse.json({ error: "Terjadi kesalahan." }, { status: 500 });
  }
}
