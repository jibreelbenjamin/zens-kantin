import { NextResponse } from "next/server";
import { requireRole } from "@/lib/supabase/require-role";
import { logActivity } from "@/lib/activity-log";
import { ACTIVITY_ACTIONS } from "@/lib/constants";

/**
 * Kasir menyampingkan (atau mengembalikan ke antrian) pesanan yang masih
 * berstatus 'pending' — dipakai untuk pelanggan yang mau bayar belakangan.
 * Cuma penanda urutan tampilan di halaman Kasir (lihat order-queue.tsx),
 * status pesanan TETAP 'pending' & TIDAK memengaruhi laporan/statistik.
 */
export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  try {
    const { admin, profile } = await requireRole(["kasir", "admin"]);
    const { disampingkan } = await request.json();
    if (typeof disampingkan !== "boolean") {
      return NextResponse.json({ error: "Nilai tidak valid." }, { status: 400 });
    }

    const { data: existing } = await admin
      .from("orders")
      .select("nama_pemesan,nama_produk,qty")
      .eq("id", params.id)
      .maybeSingle();
    const label = existing ? `${existing.nama_pemesan} — ${existing.nama_produk} x${existing.qty}` : params.id;

    const { error } = await admin.from("orders").update({ disampingkan }).eq("id", params.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    await logActivity({
      admin, userId: profile.id, namaUser: profile.nama, aksi: ACTIVITY_ACTIONS.PESANAN_DISAMPINGKAN,
      deskripsi: disampingkan ? `Menyampingkan pesanan: ${label}` : `Mengembalikan pesanan ke antrian: ${label}`,
      request,
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof Response) return e;
    return NextResponse.json({ error: "Terjadi kesalahan." }, { status: 500 });
  }
}
