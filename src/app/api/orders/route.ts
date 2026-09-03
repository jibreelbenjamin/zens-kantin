import { NextResponse } from "next/server";
import { requireRole } from "@/lib/supabase/require-role";
import { logActivity } from "@/lib/activity-log";
import { ACTIVITY_ACTIONS } from "@/lib/constants";
import { formatRupiah } from "@/lib/utils";

/**
 * Buat pesanan (satu atau banyak item sekaligus). Dipakai oleh halaman
 * pelanggan (pesan sendiri) maupun dialog "Buat Pesanan Langsung" di kasir —
 * dua-duanya lewat endpoint ini, bukan memanggil RPC Supabase langsung dari
 * browser.
 */
export async function POST(request: Request) {
  try {
    const { supabase, admin, profile } = await requireRole(["admin", "kasir", "pelanggan"]);
    const { items, pembayaran_id, nama_pemesan } = await request.json();

    if (!Array.isArray(items) || items.length === 0 || !pembayaran_id) {
      return NextResponse.json({ error: "Data pesanan tidak valid." }, { status: 400 });
    }

    // Dipanggil lewat sesi user sendiri karena create_order_batch mengambil
    // identitas & role dari auth.uid().
    const { data, error } = await supabase.rpc("create_order_batch", {
      p_items: items.map((it: { produk_id: string; qty: number }) => ({ produk_id: it.produk_id, qty: it.qty })),
      p_pembayaran_id: pembayaran_id,
      p_nama_pemesan: profile.role === "pelanggan" ? null : (nama_pemesan || "Pelanggan Langsung"),
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    const rows = (data ?? []) as { nama_pemesan: string; nama_produk: string; qty: number; harga_total: number }[];
    if (rows.length > 0) {
      const namaPemesan = rows[0].nama_pemesan;
      const totalHarga = rows.reduce((sum, o) => sum + Number(o.harga_total ?? 0), 0);
      const deskripsi = rows.length === 1
        ? `${namaPemesan} memesan ${rows[0].nama_produk} x${rows[0].qty}`
        : `${namaPemesan} memesan ${rows.length} produk (${formatRupiah(totalHarga)})`;

      await logActivity({
        admin, userId: profile.role === "pelanggan" ? profile.id : null, namaUser: namaPemesan,
        aksi: ACTIVITY_ACTIONS.PESANAN_MASUK, deskripsi, request,
      });
    }

    return NextResponse.json({ orders: data });
  } catch (e) {
    if (e instanceof Response) return e;
    return NextResponse.json({ error: "Terjadi kesalahan." }, { status: 500 });
  }
}
