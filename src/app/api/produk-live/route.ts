import { NextResponse } from "next/server";
import { requireRole } from "@/lib/supabase/require-role";

/**
 * Daftar produk untuk polling "realtime" di halaman pelanggan & kasir —
 * satu-satunya jalur fetch produk dari client, supaya browser tidak pernah
 * query langsung ke Supabase (baik lewat .from() maupun channel realtime
 * yang mengirim seluruh baris apa adanya). Diurutkan berdasarkan abjad.
 *
 * Kolom `modal` (harga pokok) HANYA dikirim untuk kasir & admin — pelanggan
 * tidak pernah menerimanya sama sekali dari server, bukan cuma disaring di
 * client seperti sebelumnya (yang tetap mengirim datanya lewat websocket).
 */
export async function GET() {
  try {
    const { supabase, profile } = await requireRole(["admin", "kasir", "pelanggan"]);

    const columns =
      profile.role === "pelanggan"
        ? "id,nama,gambar_url,stok,harga_jual,is_active,kategori_id,created_at,updated_at"
        : "*";

    const { data, error } = await supabase.from("products").select(columns).order("nama", { ascending: true });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    return NextResponse.json({ products: data ?? [] });
  } catch (e) {
    if (e instanceof Response) return e;
    return NextResponse.json({ error: "Terjadi kesalahan." }, { status: 500 });
  }
}
