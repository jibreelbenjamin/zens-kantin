import { NextResponse } from "next/server";
import { requireRole } from "@/lib/supabase/require-role";
import { logActivity } from "@/lib/activity-log";
import { ACTIVITY_ACTIONS } from "@/lib/constants";

/** Kasir/admin mengubah status pembayaran pesanan (konfirmasi lunas, batalkan, dsb). */
export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  try {
    const { admin, supabase, profile } = await requireRole(["kasir", "admin"]);
    const { status, bukti_bayar_url } = await request.json();
    // "tidak_dibayar" (v8) dipensiunkan di v10 — tidak lagi bisa dibuat dari
    // sini, hanya baris LAMA yang mungkin masih memilikinya (lihat constants.ts).
    if (!["pending", "paid", "cancelled"].includes(status)) {
      return NextResponse.json({ error: "Status tidak valid." }, { status: 400 });
    }

    const { data: existing } = await admin
      .from("orders")
      .select("nama_pemesan,nama_produk,qty")
      .eq("id", params.id)
      .maybeSingle();
    const label = existing ? `${existing.nama_pemesan} — ${existing.nama_produk} x${existing.qty}` : params.id;

    if (status === "paid") {
      // Dipanggil lewat sesi user sendiri (bukan admin/service-role) karena
      // function confirm_payment mengambil identitas kasir dari auth.uid().
      const { error } = await supabase.rpc("confirm_payment", {
        p_order_id: params.id,
        p_bukti_bayar_url: bukti_bayar_url ?? null,
      });
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });

      await logActivity({
        admin, userId: profile.id, namaUser: profile.nama, aksi: ACTIVITY_ACTIONS.PEMBAYARAN,
        deskripsi: `Konfirmasi lunas: ${label}`, request,
      });
    } else {
      const { error } = await admin.from("orders").update({ status_pembayaran: status }).eq("id", params.id);
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });

      // Dulu transisi ke cancelled TIDAK tercatat sama sekali di log
      // aktivitas (cuma "paid" yang otomatis ke-log lewat trigger) —
      // sekarang ikut tercatat.
      if (status === "cancelled") {
        await logActivity({
          admin, userId: profile.id, namaUser: profile.nama, aksi: ACTIVITY_ACTIONS.PESANAN_DIBATALKAN,
          deskripsi: `Membatalkan pesanan: ${label}`, request,
        });
      }
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof Response) return e;
    return NextResponse.json({ error: "Terjadi kesalahan." }, { status: 500 });
  }
}
